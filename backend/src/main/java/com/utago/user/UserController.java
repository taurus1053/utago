package com.utago.user;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 마이페이지 프로필 — claude/소셜_마이페이지_기획.md 5-1. */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserProfileService userProfileService;
    private final LearningStatsService learningStatsService;
    private final TitleService titleService;

    @GetMapping("/me")
    public ResponseEntity<MyPageResponse> getMyPage(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(userProfileService.getMyPage(userId));
    }

    /** 마이페이지 학습 통계 4타일 + 스트릭 캘린더 — claude/소셜_마이페이지_기획.md 10번. */
    @GetMapping("/me/stats")
    public ResponseEntity<LearningStatsResponse> getMyStats(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(learningStatsService.getStats(userId));
    }

    /** AdminTranslations/AdminSongs 등이 호출하는 role 확인 — 지금까지 대응 컨트롤러가 없었음. */
    @GetMapping("/me/role")
    public ResponseEntity<Map<String, String>> getMyRole(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(Map.of("role", userProfileService.getRole(userId).name()));
    }

    @PatchMapping("/me")
    public ResponseEntity<MyPageResponse> updateStatusMessage(
            @RequestBody UpdateStatusMessageRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(userProfileService.updateStatusMessage(userId, request.statusMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /** 칭호 컬렉션 — claude/소셜_마이페이지_기획.md 15-6번. 카테고리별 달성 현황 전체. */
    @GetMapping("/me/titles")
    public ResponseEntity<TitlesResponse> getMyTitles(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(titleService.getTitles(userId));
    }

    /** 착용 칭호 변경 — 아직 달성하지 못한 칭호는 TitleService가 거부한다. */
    @PatchMapping("/me/equipped-title")
    public ResponseEntity<TitlesResponse> equipTitle(
            @RequestBody EquipTitleRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(titleService.equip(userId, request.code()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /** 학습 화면이 보내는 체류 시간 하트비트 — 누적 학습시간 칭호(1/5/10/30/50/100시간)의
     *  원천 데이터(User.totalStudySeconds). */
    @PostMapping("/me/study-ping")
    public ResponseEntity<StudyPingResponse> studyPing(
            @RequestBody StudyPingRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(userProfileService.addStudySeconds(userId, request.seconds()));
    }

    private Long extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long userId) return userId;
        return null;
    }
}
