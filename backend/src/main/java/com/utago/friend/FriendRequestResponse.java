package com.utago.friend;

import java.time.LocalDateTime;

// 받은/보낸 요청 한 줄 — requestId로 수락/거절/취소를 호출한다. userId/nickname/avatar는
// "상대방"(받은 요청이면 요청을 보낸 사람, 보낸 요청이면 요청을 받은 사람) 기준.
public record FriendRequestResponse(
        Long requestId,
        Long userId,
        String nickname,
        String avatarColor,
        String avatarInitial,
        LocalDateTime createdAt
) {}
