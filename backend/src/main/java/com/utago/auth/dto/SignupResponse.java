package com.utago.auth.dto;

public record SignupResponse(
        Long userId,
        String email,
        String message
) {
}
