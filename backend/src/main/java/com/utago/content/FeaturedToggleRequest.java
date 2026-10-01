package com.utago.content;

/** 관리자 "추천곡 관리" 화면 — 곡 하나를 오늘의 추천곡 후보로 켜거나 끌 때의 요청 본문. */
public record FeaturedToggleRequest(boolean featured) {
}
