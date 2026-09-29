package com.utago.dictionary;

import com.utago.ai.TranslationService;
import com.utago.common.Lang;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 서버 기동 시 한 번, 뜻(WordMeaning)이 아직 없는 기존 Word(주로 이 기능이 추가되기 전에
 * 등록된 곡들의 단어)를 JMdict+AI 번역으로 채워준다.
 *
 * 멱등적 — 이미 뜻이 있는 단어는 건드리지 않으므로 매 기동마다 실행해도 안전하다. 한 번에
 * 너무 많이 처리하면 기동이 느려지므로 배치 상한을 둔다(남으면 다음 기동 때 이어서 처리됨).
 */
@Component
@RequiredArgsConstructor
public class DictionaryBackfillRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DictionaryBackfillRunner.class);
    private static final int MAX_WORDS_PER_STARTUP = 300;

    private final WordRepository wordRepository;
    private final WordMeaningRepository wordMeaningRepository;
    private final WordMeaningEnrichmentService enrichmentService;
    private final TranslationService translationService;

    @Override
    @Transactional
    public void run(String... args) {
        if (!translationService.isAvailable()) {
            log.info("[DictionaryBackfillRunner] Claude API 미설정 — 단어 뜻 백필 건너뜀");
            return;
        }

        List<Word> allJapanese = wordRepository.findAll().stream()
                .filter(w -> w.getLang() == Lang.JA)
                .toList();
        if (allJapanese.isEmpty()) {
            return;
        }

        List<Long> ids = allJapanese.stream().map(Word::getId).toList();
        Set<Long> haveMeaning = wordMeaningRepository.findByWordIdInOrderByDisplayOrderAsc(ids).stream()
                .map(m -> m.getWord().getId())
                .collect(Collectors.toSet());

        List<Word> missing = allJapanese.stream()
                .filter(w -> !haveMeaning.contains(w.getId()))
                .limit(MAX_WORDS_PER_STARTUP)
                .toList();
        if (missing.isEmpty()) {
            return;
        }

        log.info("[DictionaryBackfillRunner] 뜻 없는 단어 {}건 백필 시작", missing.size());
        int filled = enrichmentService.enrich(missing);
        log.info("[DictionaryBackfillRunner] 백필 완료 — {}개 단어에 뜻 채움 (JMdict 미매칭/API 미설정 등으로 일부는 건너뜀)", filled);
    }
}
