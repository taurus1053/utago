package com.utago.user;

// PATCH /api/users/me — 상태 메시지 수정. null/빈 문자열이면 지운다.
public record UpdateStatusMessageRequest(String statusMessage) {}
