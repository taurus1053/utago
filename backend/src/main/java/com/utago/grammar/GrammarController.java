package com.utago.grammar;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 곡과 무관한 "문법 학습" 섹션 — claude/기획_정리.md, 2026-10-08 신규. 목록/상세는 로그인 없이도
 * 볼 수 있고(SecurityConfig의 GET permitAll 참고), 학습 체크만 로그인 필요.
 */
@RestController
@RequestMapping("/api/grammar")
@RequiredArgsConstructor
public class GrammarController {

    private final GrammarService grammarService;

    @GetMapping
    public ResponseEntity<List<GrammarEntryResponse>> listByLevel(
            @RequestParam GrammarLevel level, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        return ResponseEntity.ok(grammarService.listByLevel(level, userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<GrammarEntryDetailResponse> getDetail(
            @PathVariable Long id, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        try {
            return ResponseEntity.ok(grammarService.getDetail(id, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PatchMapping("/{id}/learned")
    public ResponseEntity<GrammarEntryDetailResponse> setLearned(
            @PathVariable Long id,
            @RequestBody UpdateGrammarLearnedRequest request,
            Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(grammarService.setLearned(id, userId, request.learned()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    private Long extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long userId) return userId;
        return null;
    }
}
