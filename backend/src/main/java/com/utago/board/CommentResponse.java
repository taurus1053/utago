package com.utago.board;

import java.time.LocalDateTime;

public record CommentResponse(
        Long id,
        String authorNickname,
        String content,
        LocalDateTime createdAt,
        boolean mine,
        Long parentCommentId
) {
    public static CommentResponse of(WordbookPostComment comment, Long viewerUserId) {
        return new CommentResponse(
                comment.getId(),
                comment.getAuthor().getNickname(),
                comment.getContent(),
                comment.getCreatedAt(),
                viewerUserId != null && viewerUserId.equals(comment.getAuthor().getId()),
                comment.getParent() != null ? comment.getParent().getId() : null);
    }
}
