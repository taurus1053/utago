package com.utago.notification;

import com.utago.board.WordbookPost;
import com.utago.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

// 알림 1건 — claude/소셜_마이페이지_기획.md 21번. recipient(받는 사람)/actor(발생시킨 사람) +
// type으로 어떤 일인지 구분하고, post는 POST_COMMENT/POST_LIKE일 때만 채워진다(친구 관련
// 알림은 null). 읽음 처리는 read 플래그만 바꾼다(삭제 없음 — 나중에 "읽은 알림 숨기기" 같은
// UI가 생기면 프론트에서 필터링하면 됨).
@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_id", nullable = false)
    private User actor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NotificationType type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id")
    private WordbookPost post;

    /** COMMENT_REPLY를 뺀 나머지 모든 타입과 달리, REPORT_RESOLVED/ANNOUNCEMENT는 매번
     * 문구가 달라서(처리 액션/공지 내용) 고정 switch 문으로 못 만든다 — 그래서 이 두
     * 컬럼이 채워진 알림은 그대로 쓴다(V36, NotificationService.toResponse 참고). */
    @Column(name = "custom_message", length = 500)
    private String customMessage;

    @Column(name = "custom_target_url", length = 200)
    private String customTargetUrl;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private boolean read = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
