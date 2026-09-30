package com.utago.home;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class HomeLyricController {

    private final HomeLyricService homeLyricService;

    /**
     * 홈 화면 "오늘의 가사" — 단어장에 있고 없고 상관없이, 공개 가사 전체에서 무작위 소절
     * 하나 + 그 소절의 단어/뜻 목록. 로그인 필요 — 본인 소유의 PRIVATE 곡 가사도 후보에
     * 포함시키려면 요청한 사용자를 알아야 해서다.
     */
    @GetMapping("/api/home/lyric-of-day")
    public ResponseEntity<LyricLineResponse> lyricOfDay(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return homeLyricService.getRandomLyricOfDay(userId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /**
     * 홈 화면 "가사 복습하기" — 내 단어장에 담긴 단어가 실제로 등장하는 소절 중 무작위 하나
     * + 그 소절의 단어/뜻 목록. 단어장이 비었거나, 담긴 단어가 어느 공개 가사에도 등장하지
     * 않으면 204.
     */
    @GetMapping("/api/home/lyric-review")
    public ResponseEntity<LyricLineResponse> lyricReview(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return homeLyricService.getRandomLyricReview(userId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    private Long extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long userId) return userId;
        return null;
    }
}
