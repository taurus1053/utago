package com.utago.home;

import java.util.List;

// 홈 화면 "오늘의 가사"/"가사 복습하기" 카드 — 가사 원문 한 소절 + 의역, 그리고 그 소절 안에
// 등장하는 단어들(+뜻) 목록. words는 char offset 순서대로 정렬해서 내려준다.
public record LyricLineResponse(
        Long songLineId,
        Long songId,
        String songTitle,
        String artist,
        String originalText,
        String translationNatural,
        List<LyricWordSpan> words
) {
}
