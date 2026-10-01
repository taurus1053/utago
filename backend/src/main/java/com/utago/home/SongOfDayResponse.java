package com.utago.home;

import com.utago.common.Lang;

// 홈 화면 "오늘의 추천곡" 카드 — 가사 원문/번역은 전혀 포함하지 않는다(저작권 문제로 "가사
// 텍스트 노출 없는 곡 추천" 방식으로 전환했다 — LyricLineResponse는 "가사 복습하기"처럼
// 사용자 본인의 단어장에 연결된 맥락에서만 계속 쓴다). 썸네일은 유튜브 자체 썸네일
// (i.ytimg.com)을 그대로 보여주므로 별도 이미지 저장이 필요 없다.
public record SongOfDayResponse(
        Long songId,
        String title,
        String artist,
        Lang sourceLang,
        String youtubeVideoId
) {
}
