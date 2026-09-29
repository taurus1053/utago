package com.utago.content.dto;

import com.utago.common.Lang;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 곡 등록 화면 - "AI 번역 초안 받기" 요청. 원문만 보내고, 서버는 번역 초안만 돌려준다
 * (자동으로 저장하지 않음 — 사용자가 확인/수정 후 실제 등록 시 함께 제출해야 저장됨).
 */
public record TranslateLinesRequest(
        @NotNull Lang sourceLang,
        @NotEmpty @Size(max = 60) List<@NotEmpty String> lines
) {}
