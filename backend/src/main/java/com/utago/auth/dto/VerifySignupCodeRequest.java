package com.utago.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record VerifySignupCodeRequest(
        @NotBlank(message = "이메일을 입력해주세요.")
        @Email(message = "올바른 이메일 형식이 아닙니다.")
        String email,

        @NotBlank(message = "인증코드를 입력해주세요.")
        @Pattern(regexp = "^[0-9]{6}$", message = "인증코드는 숫자 6자리입니다.")
        String code
) {
}
