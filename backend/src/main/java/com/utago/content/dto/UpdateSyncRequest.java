package com.utago.content.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.util.List;

/** PUT /api/songs/{id}/sync 요청 — 소절별로 고친 재생 구간(startMs~endMs)을 저장할 때 사용. */
public record UpdateSyncRequest(
        @NotNull List<@Valid LineTiming> lines
) {
    public record LineTiming(
            @NotNull Long lineId,
            @PositiveOrZero int startMs,
            @PositiveOrZero int endMs
    ) {}
}
