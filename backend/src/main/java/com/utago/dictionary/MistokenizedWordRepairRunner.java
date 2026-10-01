package com.utago.dictionary;

import com.utago.common.Lang;
import com.utago.content.SongLine;
import com.utago.nlp.JapaneseTokenizerService;
import com.utago.nlp.JapaneseTokenizerService.MistokenizedOverride;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 서버 기동 시마다, JapaneseTokenizerService.MISTOKENIZED_OVERRIDES에 등록된 규칙에 걸리는
 * "이미 등록된" 단어 사용 건을 소급해서 올바른 단어로 바로잡는다.
 *
 * 왜 필요한가 — 그 규칙표는 앞으로 "새로" 분석되는 가사(새 곡 등록)에만 자동으로 적용된다.
 * 규칙이 추가되기 전에 이미 등록된 곡들은 잘못된 단어(예: いる인데 至る로 분석됨)가 이미
 * song_line_words에 박혀 있어서, 코드만 고친다고 저절로 고쳐지지 않는다 — 이 러너가 그 간극을
 * 메운다. WordReadingRepairRunner/DictionaryBackfillRunner와 같은 "기동 시 소급 복구" 계열.
 *
 * 각 SongLineWord가 가리키는 단어(lemma)가 어느 규칙의 wrongBaseForm과 같으면, 그 소절의
 * 실제 표면형(charOffset으로 원문에서 잘라낸 텍스트)과 직전 문맥을 다시 확인해서(원문 텍스트
 * 안에서 직전 글자를 역추적 — 형태소 분석을 다시 돌리는 것보다 훨씬 가볍다) 규칙 조건에
 * 맞으면 올바른 단어(lemma)로 연결을 바꿔치기한다. 조건이 안 맞으면(예: 직전 문맥이 다름)
 * 안전하게 건드리지 않는다 — 틀렸을지 모르는 추측으로 데이터를 바꾸느니 그대로 두는 게 낫다.
 *
 * 멱등적 — 이미 올바른 단어로 연결된 SongLineWord는 규칙의 wrongBaseForm과 애초에 안
 * 맞으므로 매번 건드리지 않는다. 잘못됐던 Word(예: 至る) 자체는 삭제하지 않고 그대로 둔다 —
 * 다른 곳에서 참조 중일 수도 있고, 참조가 없어져도 그냥 안 쓰이는 사전 항목으로 남을 뿐이라
 * 안전 쪽을 택했다.
 */
@Component
@RequiredArgsConstructor
@Order(0) // WordReadingRepairRunner보다도 먼저 — 단어 자체를 바로잡은 뒤에 읽기/뜻을 검증해야 순서가 맞음
public class MistokenizedWordRepairRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MistokenizedWordRepairRunner.class);

    private final WordRepository wordRepository;
    private final SongLineWordRepository songLineWordRepository;
    private final JapaneseTokenizerService japaneseTokenizerService;

    @Override
    @Transactional
    public void run(String... args) {
        List<MistokenizedOverride> rules = JapaneseTokenizerService.MISTOKENIZED_OVERRIDES;
        if (rules.isEmpty()) {
            return;
        }

        int fixed = 0;
        Map<String, Word> correctWordCache = new HashMap<>();

        for (MistokenizedOverride rule : rules) {
            Optional<Word> wrongWord = wordRepository.findByLemmaAndLang(rule.wrongBaseForm(), Lang.JA);
            if (wrongWord.isEmpty()) {
                continue; // 아직 그 잘못된 단어 자체가 등록된 적이 없으면 손볼 것도 없음.
            }

            List<SongLineWord> occurrences = songLineWordRepository.findByWord_Id(wrongWord.get().getId());
            for (SongLineWord occurrence : occurrences) {
                SongLine line = occurrence.getSongLine();
                String text = line.getOriginalText();
                int start = occurrence.getCharOffsetStart();
                int end = occurrence.getCharOffsetEnd();
                if (start < 0 || end > text.length() || start >= end) {
                    continue; // 방어적 — 저장된 offset이 현재 원문과 안 맞으면 건드리지 않는다.
                }
                String surface = text.substring(start, end);
                String prevSurface = guessPrevSurface(text, start, rule.requiredPrevSurface());

                String correctedBaseForm = japaneseTokenizerService
                        .applyMistokenizedOverride(rule.wrongBaseForm(), surface, prevSurface);
                if (correctedBaseForm.equals(rule.wrongBaseForm())) {
                    continue; // 문맥 조건이 안 맞음 — 추측으로 바꾸지 않고 그대로 둔다.
                }

                Word correctWord = correctWordCache.computeIfAbsent(correctedBaseForm, lemma ->
                        wordRepository.findByLemmaAndLang(lemma, Lang.JA)
                                .orElseGet(() -> wordRepository.save(Word.builder()
                                        .lemma(lemma)
                                        .lang(Lang.JA)
                                        .reading(japaneseTokenizerService.readingForLemma(lemma))
                                        .pos(wrongWord.get().getPos())
                                        .dictSource("kuromoji-ipadic")
                                        .build()))
                );

                occurrence.setWord(correctWord);
                fixed++;
            }
        }

        // occurrence는 이 트랜잭션 안에서 리포지토리로 조회한 영속 엔티티라, setWord()만으로도
        // 트랜잭션 커밋 시 JPA가 변경을 감지해 자동으로 반영한다(더티 체킹) — 별도 save 불필요.
        if (fixed > 0) {
            log.info("[MistokenizedWordRepairRunner] 잘못 분석된 단어 사용 {}건 복구", fixed);
        }
    }

    /**
     * 저장된 charOffset만으로는 그때의 형태소 분석 결과(직전 토큰)가 뭐였는지 알 수 없으니,
     * 후보 문맥 문자열들(예: "に") 중 실제 원문에서 이 단어 바로 앞에 글자 그대로 나오는 게
     * 있으면 그걸 "직전 토큰"으로 간주한다. 다시 형태소 분석을 돌리는 것보다 훨씬 가볍고,
     * 이 휴리스틱이 보는 규칙들은 전부 조사 하나처럼 짧고 고정된 문자열이라 이걸로 충분하다.
     */
    private String guessPrevSurface(String text, int charOffsetStart, Set<String> candidates) {
        if (candidates == null) return null;
        for (String candidate : candidates) {
            if (charOffsetStart >= candidate.length()
                    && text.regionMatches(charOffsetStart - candidate.length(), candidate, 0, candidate.length())) {
                return candidate;
            }
        }
        return null;
    }
}
