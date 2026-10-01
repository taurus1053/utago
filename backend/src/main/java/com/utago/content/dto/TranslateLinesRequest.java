package com.utago.content.dto;

import com.utago.common.Lang;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 곡 등록 화면 - "AI 번역 초안 받기" 요청. 원문만 보내고, 서버는 번역 초안만 돌려준다
 * (자동으로 저장하지 않음 — 사용자가 확인/수정 후 실제 등록 시 함께 제출해야 저장됨).
 *
 * lines 최대 개수는 TranslationService.MAX_LINES_PER_REQUEST(한 번에 Claude에 보내는 묶음
 * 크기)보다 넉넉하게 잡는다 — 그보다 긴 곡은 TranslationService가 내부에서 여러 번 나눠
 * 호출하므로, 여기서는 "한 곡 통째로 보낼 수 있는 상한"만 막는다.
 */
public record TranslateLinesRequest(
        @NotNull Lang sourceLang,
        @NotEmpty @Size(max = 300) List<@NotEmpty String> lines
) {}
