package com.utago.user;

import java.util.List;

/**
 * 마이페이지 "학습 통계" 4타일 + 스트릭 캘린더. claude/소셜_마이페이지_기획.md 10번 참고 —
 * wordsLearned/linesCompleted/songsCompleted는 기존 UserWordProgress/UserSongProgress를
 * 실시간 집계한 값이고(별도 카운터 테이블 없음), 스트릭/캘린더는 user_activity_log 기반이다.
 */
public record LearningStatsResponse(
        int wordsLearned,
        int linesCompleted,
        int songsCompleted,
        int currentStreakDays,
        int longestStreakDays,
        /** 스트릭(연속)과 무관하게, 실제로 학습 행위를 한 "전체 날짜 수"(2026-10-07,
         * 마이페이지 "연속 학습일" 타일을 "학습일수"로 바꾸며 추가 — user_activity_log
         * 행 개수 그대로). */
        int totalActiveDays,
        List<ActivityDayResponse> calendar
) {
}
