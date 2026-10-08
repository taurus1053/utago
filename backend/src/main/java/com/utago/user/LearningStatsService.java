package com.utago.user;

import com.utago.content.SongGenre;
import com.utago.content.SongLineRepository;
import com.utago.dictionary.SongLineWordRepository;
import com.utago.wordbook.UserSongProgress;
import com.utago.wordbook.UserSongProgressRepository;
import com.utago.wordbook.UserWordProgressRepository;
import com.utago.wordbook.WordbookItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

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

    /** 스트릭 캘린더에 보여줄 주 수(마이페이지 와이어프레임 — 5주치 달력) */
    private static final int CALENDAR_WEEKS = 5;
    private static final int CALENDAR_DAYS = CALENDAR_WEEKS * 7;

    private final UserActivityLogRepository activityLogRepository;
    private final UserRepository userRepository;
    private final UserWordProgressRepository userWordProgressRepository;
    private final UserSongProgressRepository userSongProgressRepository;
    private final SongLineRepository songLineRepository;
    private final SongLineWordRepository songLineWordRepository;
    private final WordbookItemRepository wordbookItemRepository;

    /** 오늘 날짜로 활동 기록을 남긴다(이미 있으면 아무것도 안 함) — 매번 INSERT 시도 대신
     *  먼저 존재 여부를 확인해서 중복 호출(한 세션에서 여러 번 복습 등)에도 저렴하게 동작.
     *  가사 진행(SongService.updateSongProgress())에서 호출 — "오늘 학습했다"는 표시만
     *  남기면 되고, word_review_count는 건드리지 않는다. */
    @Transactional
    public void recordActivity(Long userId) {
        findOrCreateTodayLog(userId);
        bumpTimeOfDayBucket(userId);
    }

    /** 단어 복습(WordbookService.review())에서 호출 — 오늘 행을 만들거나 재사용하면서
     *  word_review_count를 1 늘린다. recordActivity()와 같은 "하루 1행" 멱등성 위에서
     *  동작하므로, 같은 날 여러 번 호출돼도 행은 하나만 유지되고 카운트만 쌓인다.
     *  마이페이지 스트릭 캘린더 칸의 색 농도가 이 값에 비례한다(ActivityDayResponse 참고). */
    @Transactional
    public void recordWordReview(Long userId) {
        UserActivityLog log = findOrCreateTodayLog(userId);
        if (log == null) return;
        log.setWordReviewCount(log.getWordReviewCount() + 1);
        activityLogRepository.save(log);
        bumpTimeOfDayBucket(userId);
    }

    /** 칭호 "학습 시간대"(TIME_OF_DAY, V29) 원천 데이터 — 지금 이 순간(LocalTime.now())이
     * 어느 버킷에 속하는지 보고 그 카운트를 1 늘린다. 단어 복습/가사 진행 양쪽에서 호출되므로
     * "학습 행위가 있었던 시각"을 전부 반영한다. 자정~06시=새벽, 06~12시=아침, 12~18시=오후,
     * 18~24시=야간(TitleCatalog.TIME_OF_DAY 참고) — 서버 시각(UTC) 기준이라 사용자의 로컬
     * 시각(예: Asia/Seoul)과 최대 9시간 어긋날 수 있다(11-2번과 같은 한계, 당장은 허용). */
    private void bumpTimeOfDayBucket(Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;
        int hour = java.time.LocalTime.now().getHour();
        if (hour < 6) {
            user.setStudyDawnCount(user.getStudyDawnCount() + 1);
        } else if (hour < 12) {
            user.setStudyMorningCount(user.getStudyMorningCount() + 1);
        } else if (hour < 18) {
            user.setStudyAfternoonCount(user.getStudyAfternoonCount() + 1);
        } else {
            user.setStudyNightCount(user.getStudyNightCount() + 1);
        }
        userRepository.save(user);
    }

    private UserActivityLog findOrCreateTodayLog(Long userId) {
        LocalDate today = LocalDate.now();
        return activityLogRepository.findByUserIdAndActivityDate(userId, today)
                .orElseGet(() -> {
                    User user = userRepository.findById(userId).orElse(null);
                    if (user == null) return null;
                    return activityLogRepository.save(
                            UserActivityLog.builder().user(user).activityDate(today).build());
                });
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

        List<UserActivityLog> logsDesc = activityLogRepository.findByUserIdOrderByActivityDateDesc(userId);
        List<LocalDate> activeDates = logsDesc.stream().map(UserActivityLog::getActivityDate).toList();
        int currentStreak = computeCurrentStreak(activeDates);
        int longestStreak = computeLongestStreak(activeDates, currentStreak);
        List<ActivityDayResponse> calendar = buildCalendar(logsDesc);

        return new LearningStatsResponse(wordsLearned, linesCompleted, songsCompleted,
                currentStreak, longestStreak, logsDesc.size(), calendar);
    }

    /**
     * 칭호 "장르"(TitleCategory.GENRE, V30) 원천 데이터 — 장르별 완곡 수. "완곡" 판정은
     * getStats()의 songsCompleted와 동일한 기준(마지막 줄 도달 + hasEngagedWithSong)을 그대로
     * 쓴다. 장르가 지정 안 된(null) 곡은 집계에서 빠진다(claude/소셜_마이페이지_기획.md 17-8번).
     */
    @Transactional(readOnly = true)
    public Map<SongGenre, Long> countCompletedSongsByGenre(Long userId) {
        Map<SongGenre, Long> counts = new EnumMap<>(SongGenre.class);
        for (UserSongProgress progress : userSongProgressRepository.findByUserId(userId)) {
            SongGenre genre = progress.getSong().getGenre();
            if (genre == null) continue;
            Long songId = progress.getSong().getId();
            int totalLines = songLineRepository.countBySongId(songId);
            if (totalLines <= 0) continue;
            int reached = Math.min(progress.getLastLineOrder() + 1, totalLines);
            if (reached >= totalLines && hasEngagedWithSong(userId, songId)) {
                counts.merge(genre, 1L, Long::sum);
            }
        }
        return counts;
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

    /**
     * 마이페이지에서 숫자 더미가 아니라 진짜 달력(일~토 요일 맞춤, 5주)으로 보여줄 수
     * 있도록, 고정 35일 역산이 아니라 **요일에 맞춰 정렬된** 5주(일요일 시작)를 만든다.
     * 이번 주 일요일부터 4주 전 일요일까지 총 35일 — 오늘이 일요일이 아니면 이번 주의
     * "아직 안 지난" 날짜(미래)도 몇 칸 포함되는데, 그 칸들은 당연히 활동이 없어서 빈
     * 칸으로 자연스럽게 보인다(프론트엔드가 굳이 숨길 필요 없음).
     */
    private List<ActivityDayResponse> buildCalendar(List<UserActivityLog> logsDesc) {
        var countByDate = new java.util.HashMap<LocalDate, Integer>();
        for (UserActivityLog log : logsDesc) {
            countByDate.put(log.getActivityDate(), log.getWordReviewCount());
        }
        LocalDate today = LocalDate.now();
        // DayOfWeek.getValue(): MONDAY=1 ... SUNDAY=7. 일요일 기준 주 시작이므로 SUNDAY=0으로 맞춘다.
        int daysSinceSunday = today.getDayOfWeek().getValue() % 7;
        LocalDate thisWeekSunday = today.minusDays(daysSinceSunday);
        LocalDate gridStart = thisWeekSunday.minusWeeks(CALENDAR_WEEKS - 1);

        List<ActivityDayResponse> calendar = new ArrayList<>(CALENDAR_DAYS);
        for (int i = 0; i < CALENDAR_DAYS; i++) {
            LocalDate date = gridStart.plusDays(i);
            boolean active = countByDate.containsKey(date);
            int wordReviewCount = countByDate.getOrDefault(date, 0);
            calendar.add(new ActivityDayResponse(date.toString(), active, wordReviewCount));
        }
        return calendar;
    }
}
