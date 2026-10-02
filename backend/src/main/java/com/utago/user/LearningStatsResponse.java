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
        List<ActivityDayResponse> calendar
) {
}
