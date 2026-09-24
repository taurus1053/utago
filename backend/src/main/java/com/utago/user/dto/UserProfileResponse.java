package com.utago.user.dto;

import com.utago.common.Lang;
import com.utago.user.User;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record UserProfileResponse(
        Long id,
        String email,
        String nickname,
        Lang nativeLang,
        LocalDate birthDate,
        LocalDateTime createdAt
) {
    public static UserProfileResponse from(User user) {
        return new UserProfileResponse(
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                user.getNativeLang(),
                user.getBirthDate(),
                user.getCreatedAt()
        );
    }
}
