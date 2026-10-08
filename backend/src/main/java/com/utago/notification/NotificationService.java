package com.utago.notification;

import com.utago.board.WordbookPost;
import com.utago.user.User;
import com.utago.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 범용 알림 시스템 — claude/소셜_마이페이지_기획.md 21번. 상단바 종 아이콘이 클릭 핸들러도
 * 없는 완전한 더미(배지 숫자 "3" 하드코딩)였던 걸 실제 기능으로 교체한다. 다루는 이벤트는
 * 사용자가 확정한 4종: 친구 요청 받음/수락됨, 내 글에 댓글/좋아요.
 *
 * notifyXxx() 메서드는 각 도메인 서비스(FriendService/WordbookPostService)가 이벤트가
 * 실제로 일어난 바로 그 시점에 호출한다 — 알림 테이블은 완전히 부가적인 기록이라, 호출하는
 * 쪽의 기존 트랜잭션 안에서 같이 커밋되면 충분하고 별도 비동기 처리는 두지 않았다.
 */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    @Transactional
    public void notifyFriendRequest(Long actorUserId, Long recipientUserId) {
        create(actorUserId, recipientUserId, NotificationType.FRIEND_REQUEST, null);
    }

    @Transactional
    public void notifyFriendAccepted(Long actorUserId, Long recipientUserId) {
        create(actorUserId, recipientUserId, NotificationType.FRIEND_ACCEPTED, null);
    }

    /** 본인 글에 본인이 댓글을 단 경우는 알림을 만들지 않는다. */
    @Transactional
    public void notifyPostComment(Long actorUserId, WordbookPost post) {
        if (actorUserId.equals(post.getAuthor().getId())) return;
        create(actorUserId, post.getAuthor().getId(), NotificationType.POST_COMMENT, post);
    }

    /** 본인 글에 본인이 좋아요를 누른 경우는 알림을 만들지 않는다. */
    @Transactional
    public void notifyPostLike(Long actorUserId, WordbookPost post) {
        if (actorUserId.equals(post.getAuthor().getId())) return;
        create(actorUserId, post.getAuthor().getId(), NotificationType.POST_LIKE, post);
    }

    private void create(Long actorUserId, Long recipientUserId, NotificationType type, WordbookPost post) {
        User actor = userRepository.findById(actorUserId).orElse(null);
        User recipient = userRepository.findById(recipientUserId).orElse(null);
        if (actor == null || recipient == null) return;
        notificationRepository.save(Notification.builder()
                .actor(actor)
                .recipient(recipient)
                .type(type)
                .post(post)
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
     * 그대로 렌더링만 하면 된다. */
    private NotificationResponse toResponse(Notification n) {
        User actor = n.getActor();
        String avatarInitial = actor.getNickname() == null || actor.getNickname().isBlank()
                ? "?" : actor.getNickname().substring(0, 1);
        String message = switch (n.getType()) {
            case FRIEND_REQUEST -> actor.getNickname() + "님이 친구 요청을 보냈어요";
            case FRIEND_ACCEPTED -> actor.getNickname() + "님이 친구 요청을 수락했어요";
            case POST_COMMENT -> actor.getNickname() + "님이 댓글을 남겼어요: " + postTitle(n);
            case POST_LIKE -> actor.getNickname() + "님이 좋아요를 눌렀어요: " + postTitle(n);
        };
        String targetUrl = switch (n.getType()) {
            case FRIEND_REQUEST, FRIEND_ACCEPTED -> "/friends";
            case POST_COMMENT, POST_LIKE -> n.getPost() != null ? "/board/" + n.getPost().getId() : "/board";
        };
        return new NotificationResponse(
                n.getId(), n.getType().name(), actor.getNickname(), actor.getAvatarColor(), avatarInitial,
                message, targetUrl, n.isRead(), n.getCreatedAt());
    }

    private String postTitle(Notification n) {
        return n.getPost() != null ? n.getPost().getTitle() : "";
    }
}
