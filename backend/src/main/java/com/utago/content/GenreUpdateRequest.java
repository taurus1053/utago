package com.utago.content;

/** 관리자 "곡 관리" 화면 — 곡 하나의 장르를 지정하거나(값) 해제(null)할 때의 요청 본문. */
public record GenreUpdateRequest(SongGenre genre) {
}
