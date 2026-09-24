package com.utago.user.dto;

import com.utago.common.Lang;
import jakarta.validation.constraints.Size;

/** 둘 다 선택 입력 — null/빈 값이면 해당 필드는 변경하지 않음. */
public record UpdateProfileRequest(

        @Size(max = 60)
        String nickname,

        Lang nativeLang
) {
}
