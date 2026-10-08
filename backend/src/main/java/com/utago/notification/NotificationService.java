package com.utago.notification;

import com.utago.board.WordbookPost;
import com.utago.board.WordbookPostComment;
import com.utago.user.User;
import com.utago.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 범용 알림 시스템 — claude/소셜_마이페이지_기획.md 21번/24번. 상단바 종 아이콘이 클릭
 * 핸들러도 없는 완전한 더미(배지 숫자 "3" 하드코딩)였던 걸 실제 기능으로 교체한다. 21번에서
 * 확정한 4종(친구 요청/수락, 내 글 댓글/좋아요)에 이어, 24번에서 대댓글/신고 처리 결과/
 * 운영진 공지 3종을 추가했다.
 *
 * notifyXxx() 메서드는 각 도메인 서비스(FriendService/WordbookPostService/ReportService)가
 * 이벤트가 실제로 일어난 바로 그 시점에 호출한다 — 알림 테이블은 완전히 부가적인 기록이라,
 * 호출하는 쪽의 기존 트랜잭션 안에서 같이 커밋되면 충분하고 별도 비동기 처리는 두지 않았다.
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Transactional
    public void notifyFriendRequest(Long actorUserId, Long recipientUserId) {
        create(actorUserId, recipientUserId, NotificationType.FRIEND_REQUEST, null, null, null);
    }

    @Transactional
    public void notifyFriendAccepted(Long actorUserId, Long recipientUserId) {
        create(actorUserId, recipientUserId, NotificationType.FRIEND_ACCEPTED, null, null, null);
    }

    /** 본인 글에 본인이 댓글을 단 경우는 알림을 만들지 않는다. */
    @Transactional
    public void notifyPostComment(Long actorUserId, WordbookPost post) {
        if (actorUserId.equals(post.getAuthor().getId())) return;
        create(actorUserId, post.getAuthor().getId(), NotificationType.POST_COMMENT, post, null, null);
    }

    /** 본인 글에 본인이 좋아요를 누른 경우는 알림을 만들지 않는다. */
    @Transactional
    public void notifyPostLike(Long actorUserId, WordbookPost post) {
        if (actorUserId.equals(post.getAuthor().getId())) return;
        create(actorUserId, post.getAuthor().getId(), NotificationType.POST_LIKE, post, null, null);
    }

    /** 대댓글(답글) 알림 — claude/소셜_마이페이지_기획.md 24번. 원댓글(parent) 작성자에게
     * 간다. 본인 댓글에 본인이 답글을 단 경우는 알림을 만들지 않는다. */
    @Transactional
    public void notifyCommentReply(Long actorUserId, WordbookPostComment parentComment) {
        if (actorUserId.equals(parentComment.getAuthor().getId())) return;
        create(actorUserId, parentComment.getAuthor().getId(), NotificationType.COMMENT_REPLY,
                parentComment.getPost(), null, null);
    }

    /** 신고 처리 결과 알림 — claude/소셜_마이페이지_기획.md 24번. 신고자(그리고 경고/정지
     * 조치를 받은 작성자)에게 간다. 액션마다 문구가 달라 고정 switch로 못 만들어서
     * message를 ReportService가 직접 만들어 넘긴다(actor는 처리한 관리자지만, 화면에는
     * 관리자 신원 대신 "운영진"으로만 보여준다 — toResponse 참고). */
    @Transactional
    public void notifyReportResolved(Long adminUserId, Long recipientUserId, String message, String targetUrl) {
        create(adminUserId, recipientUserId, NotificationType.REPORT_RESOLVED, null, message, targetUrl);
    }

    /** 운영진 공지 — claude/소셜_마이페이지_기획.md 24번. 전체 사용자에게 같은 메시지로
     * 한 번에 뿌린다(소규모 서비스 전제, 비동기 큐 없이 saveAll 한 번으로 처리). */
    @Transactional
    public void broadcastAnnouncement(Long adminUserId, String message) {
        User admin = userRepository.findById(adminUserId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
        List<User> allUsers = userRepository.findAll();
        List<Notification> notifications = allUsers.stream()
                .map(recipient -> Notification.builder()
                        .actor(admin)
                        .recipient(recipient)
                        .type(NotificationType.ANNOUNCEMENT)
                        .customMessage(message)
                        .build())
                .toList();
        notificationRepository.saveAll(notifications);
    }

    private void create(Long actorUserId, Long recipientUserId, NotificationType type, WordbookPost post,
                         String customMessage, String customTargetUrl) {
        User actor = userRepository.findById(actorUserId).orElse(null);
        User recipient = userRepository.findById(recipientUserId).orElse(null);
        if (actor == null || recipient == null) return;
        notificationRepository.save(Notification.builder()
                .actor(actor)
                .recipient(recipient)
                .type(type)
                .post(post)
                .customMessage(customMessage)
                .customTargetUrl(customTargetUrl)
                .build());
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> list(Long userId, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50));
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        return notificationRepository.countByRecipientIdAndReadFalse(userId);
    }

    @Transactional
    public void markRead(Long userId, Long notificationId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalStateException("알림을 찾을 수 없어요."));
        if (!n.getRecipient().getId().equals(userId)) {
            throw new IllegalStateException("본인 알림만 읽음 처리할 수 있어요.");
        }
        n.setRead(true);
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.markAllRead(userId);
    }

    /** message/targetUrl을 서버에서 미리 만들어 내려준다 — 프론트는 타입별 분기 없이
     * 그대로 렌더링만 하면 된다. REPORT_RESOLVED/ANNOUNCEMENT처럼 customMessage가 채워진
     * 알림은(V36) 실제 처리한 관리자 신원을 노출하지 않고 "운영진" 라벨로 고정한다. */
    private NotificationResponse toResponse(Notification n) {
        if (n.getCustomMessage() != null) {
            String label = n.getType() == NotificationType.ANNOUNCEMENT ? "공지" : "운영진";
            String targetUrl = n.getCustomTargetUrl() != null ? n.getCustomTargetUrl() : "/board";
            return new NotificationResponse(
                    n.getId(), n.getType().name(), label, "#5f26f3", "!",
                    n.getCustomMessage(), targetUrl, n.isRead(), n.getCreatedAt());
        }

        User actor = n.getActor();
        String avatarInitial = actor.getNickname() == null || actor.getNickname().isBlank()
                ? "?" : actor.getNickname().substring(0, 1);
        String message = switch (n.getType()) {
            case FRIEND_REQUEST -> actor.getNickname() + "님이 친구 요청을 보냈어요";
            case FRIEND_ACCEPTED -> actor.getNickname() + "님이 친구 요청을 수락했어요";
            case POST_COMMENT -> actor.getNickname() + "님이 댓글을 남겼어요: " + postTitle(n);
            case POST_LIKE -> actor.getNickname() + "님이 좋아요를 눌렀어요: " + postTitle(n);
            case COMMENT_REPLY -> actor.getNickname() + "님이 답글을 남겼어요: " + postTitle(n);
            case REPORT_RESOLVED, ANNOUNCEMENT -> ""; // customMessage가 항상 있어 위 분기에서 처리됨
        };
        String targetUrl = switch (n.getType()) {
            case FRIEND_REQUEST, FRIEND_ACCEPTED -> "/friends";
            case POST_COMMENT, POST_LIKE, COMMENT_REPLY -> n.getPost() != null ? "/board/" + n.getPost().getId() : "/board";
            case REPORT_RESOLVED, ANNOUNCEMENT -> "/board";
        };
        return new NotificationResponse(
                n.getId(), n.getType().name(), actor.getNickname(), actor.getAvatarColor(), avatarInitial,
                message, targetUrl, n.isRead(), n.getCreatedAt());
    }

    private String postTitle(Notification n) {
        return n.getPost() != null ? n.getPost().getTitle() : "";
    }
}
