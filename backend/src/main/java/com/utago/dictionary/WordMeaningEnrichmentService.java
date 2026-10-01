package com.utago.dictionary;

import com.utago.ai.TranslationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 뜻(WordMeaning)이 아직 없는 Word들을 JMdict(영어 뜻 원문, JMdictLookupService) + Claude 번역
 * (TranslationService)으로 채워준다. 곡 등록 시(SongService, 실시간) / 서버 기동 시 백필
 * (DictionaryBackfillRunner) 양쪽에서 재사용 — 로직 중복 방지용 공통 컴포넌트.
 *
 * Claude API 키가 없거나 JMdict에 없는 단어는 조용히 건너뛴다 — "뜻 준비 중"으로 남아있는
 * 것 자체는 기능 장애가 아니라 정상적인 폴백 상태.
 */
@Component
@RequiredArgsConstructor
public class WordMeaningEnrichmentService {

    private static final int BATCH_SIZE = 30;

    private final JMdictLookupService jmdictLookupService;
    private final TranslationService translationService;
    private final WordMeaningRepository wordMeaningRepository;

    /**
     * @param words 이미 "뜻이 없는 상태"로 걸러진 Word 목록이어야 한다(호출자 책임 — 여기서는
     *              중복 채우기 방지를 위한 재확인을 하지 않는다).
     * @return 실제로 뜻이 채워진 단어 수
     */
    public int enrich(List<Word> words) {
        if (words == null || words.isEmpty() || !translationService.isAvailable()) {
            return 0;
        }
        int filled = 0;
        for (int from = 0; from < words.size(); from += BATCH_SIZE) {
            List<Word> batch = words.subList(from, Math.min(from + BATCH_SIZE, words.size()));
            filled += enrichBatch(batch);
        }
        return filled;
    }

    private int enrichBatch(List<Word> batch) {
        List<Word> matched = new ArrayList<>();
        List<TranslationService.WordGlossQuery> queries = new ArrayList<>();

        for (Word w : batch) {
            jmdictLookupService.lookup(w.getLemma(), w.getReading()).ifPresent(entry -> {
                // 주의: 센스(sense) 하나를 통째로 flatMap해서 그 안의 영어 gloss를 전부 모으면
                // 안 된다 — JMdict은 "같은 뜻(센스) 하나"를 여러 영어 동의어로 표기한다
                // (예: 非公開 한 센스가 "nondisclosure / private / confidential"로 한 번에
                // 적혀있음). 이걸 다 따로 번역해버리면 "비공개/개인적/비밀"처럼 사실상 같은
                // 뜻이 중복으로 나열된다. 센스마다 대표 gloss(첫 번째) 하나만 뽑아서 번역해야
                // 서로 다른 뜻(센스)별로 한 줄씩 나온다.
                List<String> glosses = entry.senses().stream()
                        .map(s -> s.glossesEn().isEmpty() ? null : s.glossesEn().get(0))
                        .filter(g -> g != null && !g.isBlank())
                        .distinct()
                        .limit(5)
                        .toList();
                if (!glosses.isEmpty()) {
                    String pos = entry.senses().isEmpty() ? null : entry.senses().get(0).pos();
                    matched.add(w);
                    queries.add(new TranslationService.WordGlossQuery(w.getLemma(), pos, glosses));
                }
            });
        }
        if (queries.isEmpty()) {
            return 0;
        }

        List<List<String>> translated = translationService.translateWordMeanings(queries);
        List<WordMeaning> toSave = new ArrayList<>();
        for (int i = 0; i < matched.size() && i < translated.size(); i++) {
            Word w = matched.get(i);
            int order = 0;
            for (String meaning : translated.get(i)) {
                if (meaning == null || meaning.isBlank()) {
                    continue;
                }
                toSave.add(WordMeaning.builder()
                        .word(w)
                        .meaningText(meaning.trim())
                        .displayOrder(order++)
                        .build());
            }
        }
        if (!toSave.isEmpty()) {
            wordMeaningRepository.saveAll(toSave);
        }
        return matched.size();
    }
}
