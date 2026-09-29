package com.utago.auth.dto;

/** 로그인 응답. token 은 JWT — 프론트가 이 키 이름을 그대로 읽어서 localStorage에 저장한다. */
public record AuthResponse(String token, Long userId, String email, String nickname) {}
