package com.utago.content;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Optional;

/**
 * 유튜브 공개 oEmbed 엔드포인트(인증 불필요)로 영상 제목/채널명만 가져온다.
 * 가사나 자막은 전혀 다루지 않는다 — 딱 "이 영상 제목이 뭐야?" 수준의 메타데이터만.
 */
@Component
public class YoutubeOEmbedClient {

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public record VideoMeta(String title, String authorName) {}

    public Optional<VideoMeta> fetch(String videoId) {
        try {
            String watchUrl = "https://www.youtube.com/watch?v=" + videoId;
            String oembedUrl = "https://www.youtube.com/oembed?format=json&url=" + watchUrl;

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(oembedUrl))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                return Optional.empty();
            }

            JsonNode json = OBJECT_MAPPER.readTree(response.body());
            String title = json.path("title").asText(null);
            String authorName = json.path("author_name").asText(null);
            if (title == null) {
                return Optional.empty();
            }
            return Optional.of(new VideoMeta(title, authorName));
        } catch (Exception e) {
            // 네트워크 문제/삭제된 영상 등 — 조회 실패는 그냥 "정보 없음"으로 처리.
            return Optional.empty();
        }
    }
}
