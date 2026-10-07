package com.utago.dictionary;

import com.utago.common.Lang;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * 서버 기동 시마다, 이미 song_line_words에 박혀 있는 "ん" 단독 토큰 사용 건을 지운다.
 *
 * 왜 필요한가 — JapaneseTokenizerService.tokenize()의 vocabWorthy 판정에 "ん 단독 토큰은
 * 항상 제외"하는 규칙을 새로 추가했는데(〜んだ/〜んです의 の 축약형이 名詞-非自立로
 * 분석되는 바람에 SKIP_POS를 피해 "단어"로 잘못 저장되던 문제), 이 규칙은 앞으로 "새로"
 * 분석되는 가사에만 적용된다. 이미 등록된 곡들은 "뜻 준비 중"짜리 가짜 단어 ん이 이미
 * song_line_words에 저장돼 있어서, 코드만 고친다고 저절로 없어지지 않는다 — 이 러너가 그
 * 간극을 메운다. MistokenizedWordRepairRunner와 같은 "기동 시 소급 복구" 계열.
 *
 * Word("ん") 자체는 지우지 않는다 — 다른 곳(예: 사용자 단어장)에서 이미 참조 중일 수
 * 있어서, 추측으로 지우느니 그대로 두는 게 안전하다(MistokenizedWordRepairRunner와 같은
 * 원칙). 가사 소절에 걸린 연결(SongLineWord)만 지워서, 가사 복습하기/가사 상세 화면의
 * 단어 목록에 더 이상 뜨지 않게 한다.
 *
 * 멱등적 — 이미 지워졌으면 occurrences가 비어 있어 아무 일도 안 한다.
 */
@Component
@RequiredArgsConstructor
@Order(1) // MistokenizedWordRepairRunner(Order 0) 다음 — 단어 자체를 바로잡은 뒤에 정리
public class LoneNWordRepairRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(LoneNWordRepairRunner.class);

    private final WordRepository wordRepository;
    private final SongLineWordRepository songLineWordRepository;

    @Override
    @Transactional
    public void run(String... args) {
        Optional<Word> loneN = wordRepository.findByLemmaAndLang("ん", Lang.JA);
        if (loneN.isEmpty()) {
            return; // 아직 "ん"이 단어로 등록된 적이 없으면 손볼 것도 없음.
        }

        List<SongLineWord> occurrences = songLineWordRepository.findByWord_Id(loneN.get().getId());
        if (occurrences.isEmpty()) {
            return;
        }

        songLineWordRepository.deleteAll(occurrences);
        log.info("[LoneNWordRepairRunner] 가짜 단어 'ん' 가사 연결 {}건 제거", occurrences.size());
    }
}
