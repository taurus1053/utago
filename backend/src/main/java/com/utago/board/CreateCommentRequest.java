package com.utago.board;

// POST /api/board/posts/{id}/comments
public record CreateCommentRequest(String content) {}
