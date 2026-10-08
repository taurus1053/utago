package com.utago.report;

import com.utago.user.Role;
import com.utago.user.User;
import com.utago.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** 관리자 전용 "신고 관리" 화면 API — claude/소셜_마이페이지_기획.md 23번. ADMIN 여부 확인은
 * 다른 관리자 컨트롤러(AdminSongController 등)와 동일하게 매 요청마다 직접 확인한다. */
@RestController
@RequestMapping("/api/admin/reports")
@RequiredArgsConstructor
public class AdminReportController {

    private final ReportService reportService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<Page<ReportResponse>> list(
            @RequestParam(required = false) ReportStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication
    ) {
        HttpStatus failure = adminCheckFailure(authentication);
        if (failure != null) return ResponseEntity.status(failure).build();
        return ResponseEntity.ok(reportService.listReports(status, page, size));
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<ReportResponse> resolve(
            @PathVariable Long id,
            @RequestBody ResolveReportRequest request,
            Authentication authentication
    ) {
        Long adminUserId = extractUserId(authentication);
        HttpStatus failure = adminCheckFailure(authentication);
        if (failure != null) return ResponseEntity.status(failure).build();
        return ResponseEntity.ok(reportService.resolveReport(adminUserId, id, request.action(), request.suspendDays()));
    }

    private HttpStatus adminCheckFailure(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return HttpStatus.UNAUTHORIZED;
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getRole() != Role.ADMIN) return HttpStatus.FORBIDDEN;
        return null;
    }

    private Long extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long userId) return userId;
        return null;
    }
}
