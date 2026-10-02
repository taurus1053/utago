package com.utago.user;

/** 마이페이지 스트릭 캘린더 한 칸 — date(ISO yyyy-MM-dd), 그날 학습 행위가 있었는지. */
public record ActivityDayResponse(String date, boolean active) {
}
