package com.utago.auth.dto;

public record NicknameAvailabilityResponse(
        String nickname,
        boolean available
) {
}
