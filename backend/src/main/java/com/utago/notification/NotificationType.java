package com.utago.notification;

/** 알림 종류 — claude/소셜_마이페이지_기획.md 21번. 네 가지 이벤트만 다룬다(사용자가
 * 범위로 확정한 것: 친구 요청/수락 + 내 글 댓글/좋아요). */
public enum NotificationType {
    FRIEND_REQUEST,
    FRIEND_ACCEPTED,
    POST_COMMENT,
    POST_LIKE
}
