package com.utago.notification;

import com.utago.user.Role;
import com.utago.user.User;
import com.utago.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 관리자 전용 "운영진 공지" 발송 — claude/소셜_마이페이지_기획.md 24번. 전체 사용자에게
 * 알림 1건씩 뿌린다(NotificationService.broadcastAnnouncement). ADMIN 여부 확인은 다른
 * 관리자 컨트롤러(AdminReportController 등)와 동일한 패턴. */
@RestController
@RequestMapping("/api/admin/announcements")
@RequiredArgsConstructor
public class AdminAnnouncementController {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    @PostMapping
    public ResponseEntity<Void> create(@RequestBody CreateAnnouncementRequest request, Authentication authentication) {
        HttpStatus failure = adminCheckFailure(authentication);
        if (failure != null) return ResponseEntity.status(failure).build();
        if (request.message() == null || request.message().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        notificationService.broadcastAnnouncement(extractUserId(authentication), request.message().trim());
        return ResponseEntity.status(HttpStatus.CREATED).build();
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
