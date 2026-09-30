package com.utago.home;

import com.utago.common.Lang;

import java.util.List;

// 홈 화면 "오늘의 가사"/"가사 복습하기" — 가사 한 소절 안에 등장하는 단어 하나 + 뜻.
// start/end는 원문(originalText) 안에서 이 단어가 차지하는 글자 구간(강조 표시용).
public record LyricWordSpan(
        Long wordId,
        String lemma,
        Lang lang,
        String reading,
        List<String> meanings,
        int start,
        int end
) {
}
