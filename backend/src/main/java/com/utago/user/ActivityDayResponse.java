package com.utago.user;

/** 마이페이지 스트릭 캘린더 한 칸 — date(ISO yyyy-MM-dd), 그날 학습 행위가 있었는지,
 * 그날 단어를 몇 번 복습했는지(wordReviewCount — 칸 색 농도를 여기 비례해서 그린다). */
public record ActivityDayResponse(String date, boolean active, int wordReviewCount) {
}
