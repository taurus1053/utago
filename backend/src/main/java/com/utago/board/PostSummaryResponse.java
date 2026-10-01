package com.utago.board;

import java.time.LocalDateTime;
import java.util.List;

// 게시판 목록 화면 카드 하나. wordbookDownloadCount는 wordbooks.download_count를 그대로
// 보여준다(게시글 자체 카운터를 따로 안 두는 이유는 V21 마이그레이션 주석 참고).
public record PostSummaryResponse(
        Long id,
        String title,
        String authorNickname,
        boolean official,
        LocalDateTime createdAt,
        int likeCount,
        int commentCount,
        int wordbookDownloadCount,
        int saveCount,
        boolean likedByMe,
        Long wordbookId,
        String wordbookName,
        String wordbookEmoji,
        int wordbookItemCount,
        List<String> wordbookPreviewLemmas
) {}
