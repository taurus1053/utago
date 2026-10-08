package com.utago.friend;

// 검색 결과에서 "이 사람과 나는 지금 무슨 사이인지" — 버튼 상태 결정용(친구 페이지 미리보기 참고).
public enum FriendRelationStatus {
    NONE,
    PENDING_OUTGOING, // 내가 보낸 요청이 대기 중
    PENDING_INCOMING, // 상대가 보낸 요청이 대기 중(내가 수락/거절해야 함)
    FRIENDS
}
