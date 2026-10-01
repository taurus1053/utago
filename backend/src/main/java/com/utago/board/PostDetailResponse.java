package com.utago.board;

import java.time.LocalDateTime;
import java.util.List;

public record PostDetailResponse(
        Long id,
        String title,
        String body,
        String authorNickname,
        boolean mine,
        boolean official,
        LocalDateTime createdAt,
        int likeCount,
        int commentCount,
        int wordbookDownloadCount,
        boolean likedByMe,
        boolean savedByMe,
        Long wordbookId,
        String wordbookName,
        String wordbookEmoji,
        int wordbookItemCount,
        List<String> wordbookPreviewLemmas,
        List<CommentResponse> comments
) {}
