package com.utago.content.dto;

import java.util.List;

/**
 * available=false 면 서버에 번역 API 키가 설정되지 않았거나 호출에 실패한 것 —
 * 프론트는 이 경우 안내 문구를 보여주고 수동 입력으로 유도해야 한다.
 */
public record TranslateLinesResponse(boolean available, List<String> translations) {
    public static TranslateLinesResponse unavailable() {
        return new TranslateLinesResponse(false, List.of());
    }

    public static TranslateLinesResponse of(List<String> translations) {
        return new TranslateLinesResponse(true, translations);
    }
}
