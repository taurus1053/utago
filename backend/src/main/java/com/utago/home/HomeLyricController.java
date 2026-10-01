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
     * 홈 화면 "오늘의 추천곡" — 단어장에 있고 없고 상관없이, 공개 곡 전체에서 무작위로 곡
     * 하나(제목/아티스트/유튜브 영상 ID만, 가사 원문은 포함하지 않음)를 추천한다. 로그인
     * 필요 — 본인 소유의 PRIVATE 곡도 후보에 포함시키려면 요청한 사용자를 알아야 해서다.
     */
    @GetMapping("/api/home/song-of-day")
    public ResponseEntity<SongOfDayResponse> songOfDay(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return homeLyricService.getRandomSongOfDay(userId)
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
