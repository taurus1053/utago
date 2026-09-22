package com.utago.api.health;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * 프론트엔드(웹/모바일 공용)가 백엔드가 살아있는지 확인하는 용도의 엔드포인트.
 * 나중에 실제 API가 추가되면 지워도 무방합니다.
 */
@RestController
public class HealthController {

    @GetMapping("/api/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "ok",
                "service", "utago-backend",
                "timestamp", Instant.now().toString()
        );
    }
}
