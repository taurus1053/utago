package com.utago.friend;

/** claude/소셜_마이페이지_기획.md 4-1번 — PENDING(요청 중) / ACCEPTED(친구) / DECLINED·BLOCKED는
 * 당장 UI가 없어 거절·취소는 행을 지우는 방식으로 처리한다(FriendService 참고). enum 자체는
 * 기획 문서 설계를 그대로 따라 4종 유지 — 나중에 차단 기능이 생기면 BLOCKED를 실제로 쓰면 된다. */
public enum FriendshipStatus {
    PENDING,
    ACCEPTED,
    DECLINED,
    BLOCKED
}
