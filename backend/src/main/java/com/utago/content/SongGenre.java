package com.utago.content;

/**
 * 곡 장르 — 관리자 "곡 관리" 화면(AdminFeaturedSongs.jsx)에서 지정한다(claude/소셜_마이페이지_
 * 기획.md 17-8번). 대부분 언어/국적과 무관하게 스타일로만 분류하지만(J-POP처럼 모든 장르를
 * 특정 원어에 묶지는 않음 — 2026-10-08 사용자 피드백), KPOP/JPOP은 "그 나라 대중음악 씬"
 * 자체를 가리키는 말로 통용되는 예외라 사용자가 따로 추가 요청해서 포함했다(2026-10-08).
 * AI(AI 학습곡 전용 — 작사·작곡·보컬까지 AI로 만든 곡)도 하나의 장르로 취급한다. 라벨(한글
 * 표기)은 프론트엔드가 자체적으로 들고 있다(Lang의 LANG_LABEL과 동일한 패턴) — 여기 값을
 * 추가/변경하면 프론트 GENRE_OPTIONS도 같이 맞춰야 한다.
 */
public enum SongGenre {
    KPOP,
    JPOP,
    POP,
    BALLAD,
    ROCK,
    DANCE_EDM,
    HIPHOP_RNB,
    CITY_POP,
    ACOUSTIC_FOLK,
    JAZZ_SOUL,
    TROT,
    OST,
    ANIME,
    VOCALOID,
    AI
}
