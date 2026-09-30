package com.utago.dictionary;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.utago.ai.TranslationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 단어장에 담긴 단어가 아직 어느 공개 가사에도 등장하지 않았을 때(SongLineWord 예문이
 * 없을 때) 쓸 "AI 생성" 예문을 관리한다. 한 번 생성하면 word_examples 테이블에 저장해두고
 * 재사용한다 — 볼 때마다 다시 API를 호출하지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WordExampleService {

    private final WordExampleRepository wordExampleRepository;
    private final WordMeaningRepository wordMeaningRepository;
    private final TranslationService translationService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 주어진 단어들의 MASTER 예문을 돌려준다 — 이미 있으면 그대로, 없고 AI가 설정돼 있으면
     * 그 자리에서 만들어 저장한 뒤 돌려준다. AI 키가 없거나 생성에 실패한 단어는 결과 맵에서
     * 빠진다(호출부가 그 단어는 예문 없이 처리).
     */
    @Transactional
    public Map<Long, WordExample> getOrGenerateExamples(List<Word> words) {
        if (words == null || words.isEmpty()) return Map.of();
        List<Word> distinctWords = words.stream().distinct().toList();
        List<Long> wordIds = distinctWords.stream().map(Word::getId).toList();

        Map<Long, WordExample> existing = wordExampleRepository.findByWordIdIn(wordIds).stream()
                // 한 단어에 여러 예문이 있을 수 있으므로(향후 SONG_LINE 예문 추가 대비),
                // SONG_LINE이 있으면 그걸, 없으면 아무 MASTER나 하나 남긴다.
                .collect(Collectors.toMap(
                        we -> we.getWord().getId(),
                        we -> we,
                        (a, b) -> a.getSourceType() == ExampleSourceType.SONG_LINE ? a : b));

        List<Word> missing = distinctWords.stream()
                .filter(w -> !existing.containsKey(w.getId()))
                .toList();
        if (missing.isEmpty() || !translationService.isAvailable()) {
            return existing;
        }

        Map<Long, List<WordMeaning>> meaningsByWordId = wordMeaningRepository
                .findByWordIdInOrderByDisplayOrderAsc(missing.stream().map(Word::getId).toList()).stream()
                .collect(Collectors.groupingBy(m -> m.getWord().getId()));

        List<TranslationService.WordExampleQuery> queries = missing.stream()
                .map(w -> new TranslationService.WordExampleQuery(
                        w.getId(),
                        w.getLemma(),
                        w.getLang(),
                        meaningsByWordId.getOrDefault(w.getId(), List.of()).stream()
                                .findFirst()
                                .map(WordMeaning::getMeaningText)
                                .orElse(null)))
                .toList();
        List<TranslationService.GeneratedExample> generated = translationService.generateWordExamples(queries);

        Map<Long, WordExample> result = new HashMap<>(existing);
        for (int i = 0; i < missing.size(); i++) {
            TranslationService.GeneratedExample g = i < generated.size() ? generated.get(i) : null;
            if (g == null) continue;
            WordExample saved = wordExampleRepository.save(WordExample.builder()
                    .word(missing.get(i))
                    .exampleText(g.exampleText())
                    .exampleTranslation(g.exampleTranslation())
                    .sourceType(ExampleSourceType.MASTER)
                    .tokensJson(toTokensJson(g.tokens()))
                    .build());
            result.put(missing.get(i).getId(), saved);
        }
        return result;
    }

    /** WordExample.tokensJson -> 토큰 리스트. 파싱 실패/없음이면 빈 리스트. */
    public List<String> parseTokens(String tokensJson) {
        if (tokensJson == null || tokensJson.isBlank()) return List.of();
        try {
            String[] arr = objectMapper.readValue(tokensJson, String[].class);
            return new ArrayList<>(List.of(arr));
        } catch (Exception e) {
            return List.of();
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
