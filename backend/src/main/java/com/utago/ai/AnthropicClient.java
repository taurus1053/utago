package com.utago.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Optional;

/**
 * Claude API(Messages API) 아주 얇은 호출 래퍼. 가사 자동 번역 초안 생성에만 쓴다.
 * API 키가 설정되어 있지 않으면(로컬 개발 등) 호출하지 않고 빈 값을 돌려준다 —
 * 번역 기능이 없어도 나머지 기능은 전부 정상 동작해야 하므로.
 */
@Component
public class AnthropicClient {

    private static final Logger log = LoggerFactory.getLogger(AnthropicClient.class);

    private static final String API_URL = "https://api.anthropic.com/v1/messages";
    private static final String ANTHROPIC_VERSION = "2023-06-01";

    private final String apiKey;
    private final String model;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AnthropicClient(
            @Value("${anthropic.api-key:}") String apiKey,
            @Value("${anthropic.model:claude-haiku-4-5-20251001}") String model
    ) {
        this.apiKey = apiKey;
        this.model = model;
    }

    @PostConstruct
    void logConfigStatus() {
        // 서버 기동 시 딱 한 번 찍어서 — 환경변수가 이 프로세스에 실제로 보이는지 바로 확인 가능하게.
        if (isConfigured()) {
            String masked = apiKey.length() > 10
                    ? apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length() - 4)
                    : "***";
            log.info("[AnthropicClient] API 키 설정됨 ({}), model={}", masked, model);
        } else {
            log.warn("[AnthropicClient] ANTHROPIC_API_KEY 가 비어있음 — AI 번역 기능 비활성화 상태로 시작됨.");
        }
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
     * 단순 프롬프트 한 번 호출 -> 텍스트 응답. 실패하거나 키 미설정이면 Optional.empty().
     */
    public Optional<String> complete(String prompt, int maxTokens) {
        if (!isConfigured()) {
            return Optional.empty();
        }
        try {
            var body = objectMapper.createObjectNode();
            body.put("model", model);
            body.put("max_tokens", maxTokens);
            var messages = body.putArray("messages");
            var userMsg = messages.addObject();
            userMsg.put("role", "user");
            userMsg.put("content", prompt);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(API_URL))
                    // (2026-10-09) 원래 30초였는데, max_tokens가 큰 호출(문법 사전 레벨 생성 등,
                    // 최대 8000)은 모델이 응답을 다 쓰는 데 30초를 넘기는 경우가 있었다 —
                    // 응답이 오기도 전에 클라이언트가 먼저 HttpTimeoutException으로 포기해버려서,
                    // 재시도해도 매번 똑같이 타임아웃으로 실패하는 문제가 있었다(GrammarEntryService
                    // N1 생성이 계속 비어있던 원인). 넉넉하게 120초로 올린다.
                    .timeout(Duration.ofSeconds(120))
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", ANTHROPIC_VERSION)
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                // 실패 원인을 반드시 로그로 남긴다 — 이게 없으면 "번역 안 됨"만 보이고 왜인지 알 방법이 없다.
                log.warn("[AnthropicClient] Claude API 호출 실패: status={}, body={}",
                        response.statusCode(), response.body());
                return Optional.empty();
            }
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode content = root.path("content");
            if (content.isArray() && content.size() > 0) {
                return Optional.ofNullable(content.get(0).path("text").asText(null));
            }
            log.warn("[AnthropicClient] Claude API 응답에 content가 없음: body={}", response.body());
            return Optional.empty();
        } catch (Exception e) {
            log.error("[AnthropicClient] Claude API 호출 중 예외 발생", e);
            return Optional.empty();
        }
    }
}
