package com.utago.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.utago.common.Lang;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 가사 원문 줄들을 자연스러운 번역으로 초안 생성. 어디까지나 "초안"이고, 사용자가 곡 등록
 * 화면에서 눈으로 확인/수정한 뒤 제출한다 — 서버가 최종 번역을 강제로 저장하지 않는다.
 * Claude API 키가 없으면 비어있는 결과를 돌려주고(기능 비활성화), 곡 등록 자체는 그대로
 * 수동 입력으로 동작한다.
 */
@Service
public class TranslationService {

    private static final int MAX_LINES_PER_REQUEST = 60;
    private static final int MAX_WORDS_PER_REQUEST = 40;

    private final AnthropicClient anthropicClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public TranslationService(AnthropicClient anthropicClient) {
        this.anthropicClient = anthropicClient;
    }

    public boolean isAvailable() {
        return anthropicClient.isConfigured();
    }

    /** 단어 뜻 채우기(WordMeaningEnrichmentService)에서 쓰는 입력 — JMdict 영어 뜻 원문을 담는다. */
    public record WordGlossQuery(String lemma, String pos, List<String> englishGlosses) {}

    /**
     * JMdict에서 가져온 영어 뜻 원문들을, 노래 가사 학습 앱에 어울리는 짧은 한국어 사전식
     * 뜻으로 변환한다. 입력과 같은 순서/개수의 결과를 돌려주며(각 원소는 그 단어의 한국어
     * 뜻 1~3개짜리 리스트), 실패하거나 키 미설정이면 전부 빈 리스트로 채운 결과를 돌려준다.
     */
    public List<List<String>> translateWordMeanings(List<WordGlossQuery> queries) {
        if (queries == null || queries.isEmpty()) {
            return List.of();
        }
        if (!anthropicClient.isConfigured()) {
            return queries.stream().map(q -> List.<String>of()).toList();
        }
        List<WordGlossQuery> trimmed = queries.size() > MAX_WORDS_PER_REQUEST
                ? queries.subList(0, MAX_WORDS_PER_REQUEST)
                : queries;

        String prompt = buildWordPrompt(trimmed);
        return anthropicClient.complete(prompt, 3000)
                .flatMap(this::parseJsonArrayOfArrays)
                .filter(result -> result.size() == trimmed.size())
                .orElseGet(() -> trimmed.stream().map(q -> List.<String>of()).toList());
    }

    private String buildWordPrompt(List<WordGlossQuery> queries) {
        StringBuilder sb = new StringBuilder();
        sb.append("다음은 일본어 단어들과 그 영어 사전 뜻(JMdict 발췌)이다. ");
        sb.append("각 단어에 대해 노래 가사 학습 앱 단어장에 쓸 한국어 사전식 뜻을 1~3개, ");
        sb.append("짧은 단어/구 형태로 제공하라(설명문 금지, 예: \"세계\", \"사회\"처럼 명사/동사 등 자연스러운 한국어 단어로). ");
        sb.append("반드시 JSON 2차원 배열로만 응답하고(바깥 배열의 각 원소가 그 단어의 한국어 뜻 문자열 배열), ");
        sb.append("바깥 배열 길이는 입력 단어 수와 정확히 같아야 한다. ");
        sb.append("다른 설명, 마크다운, 코드블록 표시 없이 순수 JSON만 출력하라.\n\n");
        for (int i = 0; i < queries.size(); i++) {
            WordGlossQuery q = queries.get(i);
            sb.append(i + 1).append(". ").append(q.lemma());
            if (q.pos() != null && !q.pos().isBlank()) {
                sb.append(" (").append(q.pos()).append(")");
            }
            sb.append(" — ").append(String.join("; ", q.englishGlosses())).append("\n");
        }
        return sb.toString();
    }

    private java.util.Optional<List<List<String>>> parseJsonArrayOfArrays(String text) {
        try {
            String jsonPart = extractJsonArray(text);
            JsonNode node = objectMapper.readTree(jsonPart);
            if (!node.isArray()) {
                return java.util.Optional.empty();
            }
            List<List<String>> out = new ArrayList<>();
            for (JsonNode inner : node) {
                List<String> meanings = new ArrayList<>();
                if (inner.isArray()) {
                    inner.forEach(n -> meanings.add(n.asText("")));
                }
                out.add(meanings);
            }
            return java.util.Optional.of(out);
        } catch (Exception e) {
            return java.util.Optional.empty();
        }
    }

    /**
     * @return lines 와 같은 개수/순서의 번역. 실패하거나 키 미설정이면 빈 리스트.
     */
    public List<String> translateLines(List<String> lines, Lang sourceLang) {
        if (!anthropicClient.isConfigured() || lines == null || lines.isEmpty()) {
            return List.of();
        }
        List<String> trimmed = lines.size() > MAX_LINES_PER_REQUEST
                ? lines.subList(0, MAX_LINES_PER_REQUEST)
                : lines;

        String prompt = buildPrompt(trimmed, sourceLang);
        return anthropicClient.complete(prompt, 2000)
                .flatMap(this::parseJsonArray)
                .filter(result -> result.size() == trimmed.size())
                .orElse(List.of());
    }

    private String buildPrompt(List<String> lines, Lang sourceLang) {
        String langName = switch (sourceLang) {
            case JA -> "일본어";
            case EN -> "영어";
            case KO -> "한국어";
        };
        StringBuilder sb = new StringBuilder();
        sb.append("다음은 노래 가사의 ").append(langName).append(" 원문을 한 줄씩 나열한 것이다. ");
        sb.append("각 줄을 한국어로 자연스럽게 의역하라(직역 아님, 노래 가사 어투). ");
        sb.append("반드시 JSON 문자열 배열로만 응답하고, 배열 길이는 입력 줄 수와 정확히 같아야 한다. ");
        sb.append("다른 설명, 마크다운, 코드블록 표시 없이 순수 JSON 배열만 출력하라.\n\n");
        for (int i = 0; i < lines.size(); i++) {
            sb.append(i + 1).append(". ").append(lines.get(i)).append("\n");
        }
        return sb.toString();
    }

    private java.util.Optional<List<String>> parseJsonArray(String text) {
        try {
            String jsonPart = extractJsonArray(text);
            JsonNode node = objectMapper.readTree(jsonPart);
            if (!node.isArray()) {
                return java.util.Optional.empty();
            }
            List<String> out = new ArrayList<>();
            node.forEach(n -> out.add(n.asText("")));
            return java.util.Optional.of(out);
        } catch (Exception e) {
            return java.util.Optional.empty();
        }
    }

    /** 모델이 가끔 앞뒤로 설명을 덧붙이는 경우를 대비해 첫 '['부터 마지막 ']'까지만 추출. */
    private String extractJsonArray(String text) {
        int start = text.indexOf('[');
        int end = text.lastIndexOf(']');
        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return text;
    }
}
