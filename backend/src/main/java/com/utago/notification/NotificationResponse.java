package com.utago.notification;

import java.time.LocalDateTime;

/** 알림 드롭다운에 보여줄 응답 — message/targetUrl은 서버에서 미리 만들어 내려준다
 * (프론트는 타입별 분기 없이 그대로 렌더링만 하면 됨, NotificationService 참고). */
public record NotificationResponse(
        Long id,
        String type,
        String actorNickname,
        String actorAvatarColor,
        String actorAvatarInitial,
        String message,
        String targetUrl,
        boolean read,
        LocalDateTime createdAt
) {
}
