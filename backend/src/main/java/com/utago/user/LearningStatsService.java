package com.utago.user;

import com.utago.content.SongLineRepository;
import com.utago.dictionary.SongLineWordRepository;
import com.utago.wordbook.UserSongProgress;
import com.utago.wordbook.UserSongProgressRepository;
import com.utago.wordbook.UserWordProgressRepository;
import com.utago.wordbook.WordbookItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 마이페이지 "학습 통계" 4타일 + 스트릭. claude/소셜_마이페이지_기획.md 10번 참고.
 *
 * - 학습한 단어 / 완료한 가사 / 완료한 곡: 기존 UserWordProgress·UserSongProgress를 그 자리에서
 *   집계한다(별도 카운터 캐시 없음 — 사용자당 데이터량이 많지 않아 실시간 계산으로 충분).
 * - 연속 학습일(스트릭)/캘린더: user_activity_log 기반. recordActivity()를 "학습 행위"가
 *   일어나는 지점(단어 복습 WordbookService.review(), 가사 진행 SongService.updateSongProgress())
 *   에서 호출해서 오늘 날짜를 하루 한 번만 기록한다.
 */
@Service
@RequiredArgsConstructor
public class LearningStatsService {

    /** 스트릭 캘린더에 보여줄 일수(마이페이지 와이어프레임 — 5주치 히트맵) */
    private static final int CALENDAR_DAYS = 35;

    private final UserActivityLogRepository activityLogRepository;
    private final UserRepository userRepository;
    private final UserWordProgressRepository userWordProgressRepository;
    private final UserSongProgressRepository userSongProgressRepository;
    private final SongLineRepository songLineRepository;
    private final SongLineWordRepository songLineWordRepository;
    private final WordbookItemRepository wordbookItemRepository;

    /** 오늘 날짜로 활동 기록을 남긴다(이미 있으면 아무것도 안 함) — 매번 INSERT 시도 대신
     *  먼저 존재 여부를 확인해서 중복 호출(한 세션에서 여러 번 복습 등)에도 저렴하게 동작. */
    @Transactional
    public void recordActivity(Long userId) {
        LocalDate today = LocalDate.now();
        if (activityLogRepository.findByUserIdAndActivityDate(userId, today).isPresent()) {
            return;
        }
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;
        activityLogRepository.save(UserActivityLog.builder().user(user).activityDate(today).build());
    }

    @Transactional(readOnly = true)
    public LearningStatsResponse getStats(Long userId) {
        int wordsLearned = userWordProgressRepository.countByUser_Id(userId);

        int linesCompleted = 0;
        int songsCompleted = 0;
        for (UserSongProgress progress : userSongProgressRepository.findByUserId(userId)) {
            Long songId = progress.getSong().getId();
            int totalLines = songLineRepository.countBySongId(songId);
            if (totalLines <= 0) continue;
            int reached = Math.min(progress.getLastLineOrder() + 1, totalLines);
            linesCompleted += reached;
            if (reached >= totalLines && hasEngagedWithSong(userId, songId)) {
                songsCompleted++;
            }
        }

        List<LocalDate> activeDates = activityLogRepository.findByUserIdOrderByActivityDateDesc(userId)
                .stream().map(UserActivityLog::getActivityDate).toList();
        int currentStreak = computeCurrentStreak(activeDates);
        int longestStreak = computeLongestStreak(activeDates, currentStreak);
        List<ActivityDayResponse> calendar = buildCalendar(activeDates);

        return new LearningStatsResponse(wordsLearned, linesCompleted, songsCompleted,
                currentStreak, longestStreak, calendar);
    }

    /**
     * "완료한 곡" 판정 — 마지막 줄까지 도달한 것만으로는 부족하고, 이 곡에 등장하는 단어를
     * 실제로 학습한 적(단어장에 추가했거나, 그 단어를 한 번이라도 복습) 있어야 한다
     * (2026-10-02 사용자 확정 — 그냥 가사만 넘겨본 것과 구분).
     */
    private boolean hasEngagedWithSong(Long userId, Long songId) {
        List<Long> wordIds = songLineWordRepository.findDistinctWordIdsBySongId(songId);
        if (wordIds.isEmpty()) return false;
        if (wordbookItemRepository.existsByWordbook_User_IdAndWordIdIn(userId, wordIds)) return true;
        return userWordProgressRepository.existsByUser_IdAndWord_IdInAndRepetitionCountGreaterThan(userId, wordIds, 0);
    }

    private int computeCurrentStreak(List<LocalDate> datesDesc) {
        if (datesDesc.isEmpty()) return 0;
        LocalDate today = LocalDate.now();
        LocalDate mostRecent = datesDesc.get(0);
        // 오늘이나 어제까지는 학습했어야 "현재 진행 중인" 스트릭으로 친다 — 그제 이전이 마지막이면 끊긴 것.
        if (!mostRecent.equals(today) && !mostRecent.equals(today.minusDays(1))) {
            return 0;
        }
        int streak = 1;
        LocalDate expected = mostRecent.minusDays(1);
        for (int i = 1; i < datesDesc.size(); i++) {
            if (datesDesc.get(i).equals(expected)) {
                streak++;
                expected = expected.minusDays(1);
            } else {
                break;
            }
        }
        return streak;
    }

    private int computeLongestStreak(List<LocalDate> datesDesc, int currentStreak) {
        if (datesDesc.isEmpty()) return 0;
        List<LocalDate> datesAsc = new ArrayList<>(datesDesc);
        java.util.Collections.reverse(datesAsc);
        int longest = 0;
        int run = 0;
        LocalDate prev = null;
        for (LocalDate d : datesAsc) {
            run = (prev != null && prev.plusDays(1).equals(d)) ? run + 1 : 1;
            longest = Math.max(longest, run);
            prev = d;
        }
        return Math.max(longest, currentStreak);
    }

    private List<ActivityDayResponse> buildCalendar(List<LocalDate> activeDatesDesc) {
        var activeSet = new java.util.HashSet<>(activeDatesDesc);
        LocalDate today = LocalDate.now();
        List<ActivityDayResponse> calendar = new ArrayList<>(CALENDAR_DAYS);
        for (int i = CALENDAR_DAYS - 1; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            calendar.add(new ActivityDayResponse(date.toString(), activeSet.contains(date)));
        }
        return calendar;
    }
}
