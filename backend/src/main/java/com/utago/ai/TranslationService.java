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

    /**
     * "문장 재배열"/"빈칸 채우기" 게임용 입력 — 아직 어느 공개 가사에도 등장하지 않은 단어를
     * 위해 AI로 예문을 새로 만들 때 쓴다. meaning은 자연스러운 예문을 만들 때 참고용.
     */
    public record WordExampleQuery(Long wordId, String lemma, Lang lang, String meaning) {}

    /**
     * AI가 만든 예문 하나 — 원문(단어의 언어)과 한국어 번역, 그리고 그 원문을 "단어/조사
     * 단위"로 쪼갠 tokens(예: 私/は/学校/へ/行きます). tokens를 이어붙이면 exampleText와
     * 정확히 같아야 한다 — 문장 재배열 게임에서 한 글자씩이 아니라 이 단위로 타일을 만든다.
     */
    public record GeneratedExample(String exampleText, String exampleTranslation, List<String> tokens) {}

    /**
     * @return queries와 같은 순서/개수의 결과. 실패하거나 키 미설정이면 전부 null로 채운
     * 결과(호출부가 그 단어는 예문 없이 넘어감).
     */
    public List<GeneratedExample> generateWordExamples(List<WordExampleQuery> queries) {
        if (queries == null || queries.isEmpty()) {
            return List.of();
        }
        if (!anthropicClient.isConfigured()) {
            return queries.stream().map(q -> (GeneratedExample) null).toList();
        }
        List<WordExampleQuery> trimmed = queries.size() > MAX_WORDS_PER_REQUEST
                ? queries.subList(0, MAX_WORDS_PER_REQUEST)
                : queries;

        String prompt = buildExamplePrompt(trimmed);
        return anthropicClient.complete(prompt, 3000)
                .flatMap(this::parseExampleArray)
                .filter(result -> result.size() == trimmed.size())
                .orElseGet(() -> trimmed.stream().map(q -> (GeneratedExample) null).toList());
    }

    private String buildExamplePrompt(List<WordExampleQuery> queries) {
        StringBuilder sb = new StringBuilder();
        sb.append("다음은 노래 가사 학습 앱 단어장에 있는 단어들이다. 각 단어마다, 그 단어의 언어로 ");
        sb.append("아주 짧고 자연스러운 예문을 한 문장씩 만들어라(초중급 학습자 난이도, 그 단어를 ");
        sb.append("반드시 원형 그대로 포함할 것). 그리고 그 예문을 자연스러운 한국어로 의역하라. ");
        sb.append("또한 그 예문 원문을 \"단어/조사(형태소) 단위\"로 쪼갠 배열도 함께 제공하라 — ");
        sb.append("예를 들어 일본어 \"私は学校へ行きます\"라면 [\"私\",\"は\",\"学校\",\"へ\",\"行きます\"] ");
        sb.append("처럼. 반드시 tokens 배열의 모든 원소를 순서대로 이어붙이면 example 원문과 ");
        sb.append("정확히 같아야 한다(공백이나 글자를 추가/누락하지 말 것). ");
        sb.append("반드시 JSON 배열로만 응답하고, 각 원소는 ");
        sb.append("{\"example\":\"...\",\"translation\":\"...\",\"tokens\":[\"...\",\"...\"]} ");
        sb.append("형태여야 하며, 배열 길이는 입력 단어 수와 정확히 같아야 한다. ");
        sb.append("다른 설명, 마크다운, 코드블록 표시 없이 순수 JSON 배열만 출력하라.\n\n");
        for (int i = 0; i < queries.size(); i++) {
            WordExampleQuery q = queries.get(i);
            String langName = switch (q.lang()) {
                case JA -> "일본어";
                case EN -> "영어";
                case KO -> "한국어";
            };
            sb.append(i + 1).append(". [").append(langName).append("] ").append(q.lemma());
            if (q.meaning() != null && !q.meaning().isBlank()) {
                sb.append(" (뜻: ").append(q.meaning()).append(")");
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    private java.util.Optional<List<GeneratedExample>> parseExampleArray(String text) {
        try {
            String jsonPart = extractJsonArray(text);
            JsonNode node = objectMapper.readTree(jsonPart);
            if (!node.isArray()) {
                return java.util.Optional.empty();
            }
            List<GeneratedExample> out = new ArrayList<>();
            for (JsonNode inner : node) {
                String example = inner.path("example").asText(null);
                String translation = inner.path("translation").asText(null);
                List<String> rawTokens = new ArrayList<>();
                JsonNode tokensNode = inner.path("tokens");
                if (tokensNode.isArray()) {
                    tokensNode.forEach(t -> rawTokens.add(t.asText("")));
                }
                // tokens가 원문과 정확히 이어붙여지지 않으면(모델이 실수한 경우) 신뢰할 수
                // 없으므로 버리고, example/translation만 있어도 예문 자체는 그대로 쓴다
                // (문장 재배열엔 못 쓰지만 플래시카드/빈칸채우기/퀴즈엔 여전히 쓸 수 있음).
                List<String> tokens = (!rawTokens.isEmpty() && String.join("", rawTokens).equals(example))
                        ? rawTokens
                        : List.of();
                if (example == null || example.isBlank() || translation == null || translation.isBlank()) {
                    out.add(null);
                } else {
                    out.add(new GeneratedExample(example, translation, tokens));
                }
            }
            return java.util.Optional.of(out);
        } catch (Exception e) {
            return java.util.Optional.empty();
        }
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
     *
     * MAX_LINES_PER_REQUEST(60)줄보다 긴 곡은 한 번의 Claude 호출로 처리하지 않고 그만큼씩
     * 나눠서 여러 번 호출한다(WordExampleService.getOrGenerateExamples와 같은 패턴) — 전에는
     * 60줄 넘는 요청을 그냥 앞 60줄만 잘라서 보내고 나머지는 버렸는데, 그러면 호출부
     * (SongController)가 "입력 줄 수와 결과 개수가 다르다"고 판단해 번역 전체를 실패
     * 처리해버렸다. 한 묶음이라도 실패하면 그 뒤는 더 불러도 의미가 없으므로 중단하고
     * 그 시점까지 모은 결과도 버린다(부분 번역은 사용자에게 혼란을 줄 수 있어 전체 실패로
     * 통일 — 기존 동작과 동일).
     */
    public List<String> translateLines(List<String> lines, Lang sourceLang) {
        if (!anthropicClient.isConfigured() || lines == null || lines.isEmpty()) {
            return List.of();
        }
        List<String> result = new ArrayList<>(lines.size());
        for (int start = 0; start < lines.size(); start += MAX_LINES_PER_REQUEST) {
            List<String> batch = lines.subList(start, Math.min(start + MAX_LINES_PER_REQUEST, lines.size()));
            String prompt = buildPrompt(batch, sourceLang);
            boolean ok = anthropicClient.complete(prompt, 2000)
                    .flatMap(this::parseJsonArray)
                    .filter(batchResult -> batchResult.size() == batch.size())
                    .map(result::addAll)
                    .orElse(false);
            if (!ok) {
                return List.of();
            }
        }
        return result;
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
