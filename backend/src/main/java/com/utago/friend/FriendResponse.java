package com.utago.friend;

// 내 친구 목록 한 줄 — 친구 페이지 "내 친구" 그리드 + 마이페이지 사이드바 친구 카드.
public record FriendResponse(
        Long userId,
        String nickname,
        String avatarColor,
        String avatarInitial,
        String statusMessage
) {}
