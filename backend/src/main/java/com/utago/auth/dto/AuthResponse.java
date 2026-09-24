package com.utago.auth.dto;

public record AuthResponse(
        String accessToken,
        Long userId,
        String email,
        String nickname
) {
}
