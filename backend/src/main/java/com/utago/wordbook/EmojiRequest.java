package com.utago.wordbook;

// PATCH /api/wordbooks/{id}/emoji — 단어장 카드 아이콘 변경.
public record EmojiRequest(String emoji) {}
