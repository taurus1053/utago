package com.utago.content.dto;

import com.utago.common.Lang;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * POST /api/songs 요청 — 곡 등록.
 * 가사 원문/번역은 반드시 사용자(직접 입력 권한이 있는 사람)가 타이핑해서 넣는다.
 * 소절별 재생 타이밍(start/end)은 아직 오디오 싱크 편집 도구가 없어서
 * 서버가 일정 간격(줄당 4초)으로 임시 배정한다 — 나중에 실제 타임스탬프로 교체 가능.
 */
public record CreateSongRequest(
        @NotBlank String title,
        @NotBlank String artist,
        @NotNull Lang sourceLang,
        String youtubeVideoId,
        @NotEmpty List<@Valid LineInput> lines
) {
    public record LineInput(
            @NotBlank String originalText,
            @NotBlank String translationNatural
    ) {}
}
