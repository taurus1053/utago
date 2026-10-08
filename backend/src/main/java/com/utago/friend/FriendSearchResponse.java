package com.utago.friend;

// 닉네임 검색 결과 한 줄 — 친구 페이지의 "검색 결과" 섹션.
public record FriendSearchResponse(
        Long userId,
        String nickname,
        String avatarColor,
        String avatarInitial,
        FriendRelationStatus relation
) {}
