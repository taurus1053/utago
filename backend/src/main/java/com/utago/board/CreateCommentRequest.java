package com.utago.board;

// POST /api/board/posts/{id}/comments
// parentCommentId가 있으면 답글(대댓글) — claude/소셜_마이페이지_기획.md 24번.
public record CreateCommentRequest(String content, Long parentCommentId) {}
