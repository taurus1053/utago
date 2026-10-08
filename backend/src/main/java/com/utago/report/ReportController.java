package com.utago.report;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 사용자가 게시글/댓글을 신고하는 엔드포인트. 처리(조회/액션)는 전부 관리자 전용
 * (AdminReportController) — claude/소셜_마이페이지_기획.md 23번. */
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @PostMapping
    public ResponseEntity<Void> create(@RequestBody CreateReportRequest request, Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        reportService.createReport(userId, request.targetType(), request.targetId(), request.reason(), request.detail());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    private Long extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long userId) return userId;
        return null;
    }
}
