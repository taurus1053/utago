package com.utago.user;

/** 칭호 하나의 달성 현황 — achieved=false면 currentValue/threshold로 진행도 바를 그릴 수 있다. */
public record TitleItemResponse(
        String code,
        String name,
        long threshold,
        String unit,
        boolean achieved,
        long currentValue
) {
}
