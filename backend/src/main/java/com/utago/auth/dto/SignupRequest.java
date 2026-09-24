package com.utago.auth.dto;

import com.utago.common.Lang;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record SignupRequest(

        @NotBlank
        @Email
        @Size(max = 255)
        String email,

        @NotBlank
        @Size(min = 8, max = 20, message = "비밀번호는 8자 이상 20자 이하여야 합니다.")
        @Pattern(
                regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^a-zA-Z0-9]).+$",
                message = "비밀번호는 영문 대문자, 소문자, 숫자, 특수기호를 모두 포함해야 합니다."
        )
        String password,

        @NotBlank
        @Size(min = 2, max = 12, message = "닉네임은 2자 이상 12자 이하여야 합니다.")
        @Pattern(
                regexp = "^[a-zA-Z0-9\\uAC00-\\uD7A3\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF]+$",
                message = "닉네임은 한글, 영문, 일본어, 숫자만 사용할 수 있습니다."
        )
        String nickname,

        @NotNull
        Lang nativeLang,

        /** 선택 입력. */
        LocalDate birthDate
) {
}
