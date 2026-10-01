package com.utago.wordbook;

// PATCH /api/wordbooks/{id}/visibility — visible=true면 공개(PUBLIC), false면 비공개(PRIVATE).
public record VisibilityRequest(boolean visible) {}
