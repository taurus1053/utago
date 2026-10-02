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

    @GetMapping("/me")
    public ResponseEntity<MyPageResponse> getMyPage(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(userProfileService.getMyPage(userId));
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

    private Long extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long userId) return userId;
        return null;
    }
}
