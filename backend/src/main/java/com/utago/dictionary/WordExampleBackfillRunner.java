package com.utago.dictionary;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.utago.ai.TranslationService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 서버 기동 시 한 번, 예문(WordExample)이 하나도 없는 단어들에게 AI로 생성한 "마스터 예문"
 * (MASTER)을 채워준다. SONG_LINE이든 MASTER든 예문이 이미 하나라도 있는 단어는 건드리지
 * 않는다 — 멱등적이라 매 기동마다 실행해도 안전하다.
 *
 * DictionaryBackfillRunner(단어 뜻 백필)와 같은 패턴. 한 번에 너무 많이 처리하면 기동이
 * 느려지고 API 레이트리밋에도 걸릴 수 있어서, 기동당 처리 상한(MAX_WORDS_PER_STARTUP)을
 * 두고 40개씩 묶어 호출 사이에 짧게 대기한다. 남은 건 다음 기동 때 이어서 처리된다.
 */
@Component
@RequiredArgsConstructor
public class WordExampleBackfillRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(WordExampleBackfillRunner.class);

    /** 기동 한 번에 최대 이만큼만 처리 — 나머지는 다음 기동 때. */
    private static final int MAX_WORDS_PER_STARTUP = 300;

    /** TranslationService.generateWordExamples 한 번 호출당 최대 단어 수와 맞춤. */
    private static final int BATCH_SIZE = 40;

    /** 레이트리밋 방지용 호출 사이 대기(ms). */
    private static final long DELAY_BETWEEN_BATCHES_MS = 1500;

    private final WordRepository wordRepository;
    private final WordExampleRepository wordExampleRepository;
    private final WordMeaningRepository wordMeaningRepository;
    private final TranslationService translationService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void run(String... args) {
        if (!translationService.isAvailable()) {
            log.info("[WordExampleBackfillRunner] Claude API 미설정 — 예문 백필 건너뜀");
            return;
        }

        List<Word> allWords = wordRepository.findAll();
        if (allWords.isEmpty()) {
            return;
        }

        Set<Long> haveExample = new HashSet<>(wordExampleRepository.findAllWordIds());
        List<Word> missing = allWords.stream()
                .filter(w -> !haveExample.contains(w.getId()))
                .limit(MAX_WORDS_PER_STARTUP)
                .toList();
        if (missing.isEmpty()) {
            return;
        }

        log.info("[WordExampleBackfillRunner] 예문 없는 단어 {}건 백필 시작 (배치 {}개씩)",
                missing.size(), BATCH_SIZE);

        Map<Long, List<WordMeaning>> meaningsByWordId = wordMeaningRepository
                .findByWordIdInOrderByDisplayOrderAsc(missing.stream().map(Word::getId).toList()).stream()
                .collect(Collectors.groupingBy(m -> m.getWord().getId()));

        int filled = 0;
        for (int from = 0; from < missing.size(); from += BATCH_SIZE) {
            List<Word> batch = missing.subList(from, Math.min(from + BATCH_SIZE, missing.size()));
            filled += processBatch(batch, meaningsByWordId);

            if (from + BATCH_SIZE < missing.size()) {
                sleep(DELAY_BETWEEN_BATCHES_MS);
            }
        }

        log.info("[WordExampleBackfillRunner] 백필 완료 — {}개 단어에 예문 채움 (생성 실패 등으로 일부는 건너뜀)", filled);
    }

    private int processBatch(List<Word> batch, Map<Long, List<WordMeaning>> meaningsByWordId) {
        List<TranslationService.WordExampleQuery> queries = batch.stream()
                .map(w -> new TranslationService.WordExampleQuery(
                        w.getId(),
                        w.getLemma(),
                        w.getLang(),
                        meaningsByWordId.getOrDefault(w.getId(), List.of()).stream()
                                .findFirst()
                                .map(WordMeaning::getMeaningText)
                                .orElse(null)))
                .toList();

        List<TranslationService.GeneratedExample> generated;
        try {
            generated = translationService.generateWordExamples(queries);
        } catch (Exception e) {
            log.warn("[WordExampleBackfillRunner] 배치 생성 중 예외 발생 — 이 배치는 건너뜀", e);
            return 0;
        }

        int filled = 0;
        for (int i = 0; i < batch.size(); i++) {
            TranslationService.GeneratedExample g = i < generated.size() ? generated.get(i) : null;
            if (g == null) continue;
            wordExampleRepository.save(WordExample.builder()
                    .word(batch.get(i))
                    .exampleText(g.exampleText())
                    .exampleTranslation(g.exampleTranslation())
                    .sourceType(ExampleSourceType.MASTER)
                    .tokensJson(toTokensJson(g.tokens()))
                    .build());
            filled++;
        }
        return filled;
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private String toTokensJson(List<String> tokens) {
        if (tokens == null || tokens.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(tokens);
        } catch (Exception e) {
            return null;
        }
    }
}
