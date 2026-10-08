-- 범용 알림 시스템 — claude/소셜_마이페이지_기획.md 21번. 상단바 종 아이콘이 완전히
-- 더미(클릭 핸들러 없음, 배지 숫자 "3" 하드코딩)였던 걸 실제 기능으로 교체한다.
-- 다루는 이벤트 4종: 친구 요청 받음/수락됨(FRIEND_REQUEST/FRIEND_ACCEPTED),
-- 내 글에 댓글/좋아요(POST_COMMENT/POST_LIKE). post_id는 친구 관련 알림에서는 NULL.
CREATE TABLE notifications (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    recipient_id  BIGINT      NOT NULL,
    actor_id      BIGINT      NOT NULL,
    type          VARCHAR(30) NOT NULL,
    post_id       BIGINT      NULL,
    is_read       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_post FOREIGN KEY (post_id) REFERENCES wordbook_posts(id) ON DELETE CASCADE,
    KEY idx_notifications_recipient_created (recipient_id, created_at),
    KEY idx_notifications_recipient_unread (recipient_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
