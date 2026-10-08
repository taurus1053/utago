package com.utago.notification;

/** 알림 종류 — claude/소셜_마이페이지_기획.md 21번/24번. 처음 4종(친구 요청/수락 + 내 글
 * 댓글/좋아요)에 이어, 24번에서 대댓글/신고 처리 결과/운영진 공지 3종을 추가했다. */
public enum NotificationType {
    FRIEND_REQUEST,
    FRIEND_ACCEPTED,
    POST_COMMENT,
    POST_LIKE,
    COMMENT_REPLY,
    REPORT_RESOLVED,
    ANNOUNCEMENT
}
