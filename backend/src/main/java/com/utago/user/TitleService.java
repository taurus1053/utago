package com.utago.user;

import com.utago.board.WordbookPost;
import com.utago.board.WordbookPostCommentRepository;
import com.utago.board.WordbookPostRepository;
import com.utago.wordbook.UserSongProgressRepository;
import com.utago.wordbook.UserWordProgressRepository;
import com.utago.wordbook.WordbookItemRepository;
import com.utago.wordbook.WordbookRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 칭호 시스템 — claude/소셜_마이페이지_기획.md 15-6번(1차)을 2026-10-07에 사용자가 다시
 * 구체화한 구간(TitleCatalog)으로 교체하고, 플레이스홀더였던 "가사 탐험가" 고정 문구 대신
 * 실제 통계를 기준으로 달성 여부를 계산한다.
 *
 * 칭호 자체는 DB에 저장하지 않고(TitleCatalog에 정적 정의), "지금 착용 중인 칭호"만
 * User.equippedTitleCode에 저장한다 — 달성 여부는 매번 현재 통계와 비교해서 실시간으로
 * 계산되므로 사용자별 "획득 이력" 테이블이 따로 필요 없다.
 */
@Service
@RequiredArgsConstructor
public class TitleService {

    /** 사용자가 칭호를 하나도 착용하지 않았을 때 보여줄 기본 문구. */
    private static final String DEFAULT_TITLE_NAME = "새내기 학습자";

    private final UserRepository userRepository;
    private final LearningStatsService learningStatsService;
    private final WordbookItemRepository wordbookItemRepository;
    private final WordbookPostRepository wordbookPostRepository;
    private final WordbookPostCommentRepository wordbookPostCommentRepository;
    private final WordbookRepository wordbookRepository;
    private final UserWordProgressRepository userWordProgressRepository;
    private final UserSongProgressRepository userSongProgressRepository;

    @Transactional(readOnly = true)
    public TitlesResponse getTitles(Long userId) {
        Map<String, Long> currentValues = computeCurrentValues(userId);
        User user = userRepository.findById(userId).orElse(null);
        String equippedCode = user == null ? null : user.getEquippedTitleCode();

        List<TitleCategoryGroupResponse> groups = new ArrayList<>();
        for (List<Title> titles : TitleCatalog.ALL_BY_CATEGORY) {
            TitleCategory category = titles.get(0).category();
            List<TitleItemResponse> items = titles.stream()
                    .map(t -> {
                        long current = currentValues.getOrDefault(t.code(), 0L);
                        return new TitleItemResponse(t.code(), t.name(), t.threshold(), t.unit(),
                                current >= t.threshold(), current);
                    })
                    .toList();
            groups.add(new TitleCategoryGroupResponse(category.name(), category.getLabel(), items));
        }

        String equippedName = resolveEquippedName(equippedCode, currentValues);
        return new TitlesResponse(groups, equippedCode, equippedName);
    }

    /** 착용 칭호 변경 — 아직 달성하지 못한 칭호는 착용할 수 없다. */
    @Transactional
    public TitlesResponse equip(Long userId, String code) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
        Title title = findTitle(code)
                .orElseThrow(() -> new IllegalStateException("존재하지 않는 칭호예요."));
        Map<String, Long> currentValues = computeCurrentValues(userId);
        long current = currentValues.getOrDefault(title.code(), 0L);
        if (current < title.threshold()) {
            throw new IllegalStateException("아직 달성하지 못한 칭호는 착용할 수 없어요.");
        }
        user.setEquippedTitleCode(code);
        return getTitles(userId);
    }

    /** 마이페이지 프로필 pill에 보여줄 이름 — UserProfileService가 호출한다. */
    @Transactional(readOnly = true)
    public String getEquippedTitleName(Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        String equippedCode = user == null ? null : user.getEquippedTitleCode();
        return resolveEquippedName(equippedCode, computeCurrentValues(userId));
    }

    private String resolveEquippedName(String equippedCode, Map<String, Long> currentValues) {
        if (equippedCode != null) {
            var explicit = findTitle(equippedCode);
            if (explicit.isPresent()) {
                Title t = explicit.get();
                if (currentValues.getOrDefault(t.code(), 0L) >= t.threshold()) {
                    return t.name();
                }
                // 달성 기록이 사라진(예: 데이터 정정) 경우를 대비한 방어적 처리 — 폴백으로 내려간다.
            }
        }
        // 착용 중인 칭호가 없으면, 카테고리 우선순위(단어 → 가사 → ... ) 순으로 가장 높은
        // 달성 칭호를 기본값으로 보여준다.
        for (List<Title> titles : TitleCatalog.ALL_BY_CATEGORY) {
            Title best = null;
            for (Title t : titles) {
                long current = currentValues.getOrDefault(t.code(), 0L);
                if (current >= t.threshold()) {
                    best = t;
                }
            }
            if (best != null) return best.name();
        }
        return DEFAULT_TITLE_NAME;
    }

    private java.util.Optional<Title> findTitle(String code) {
        return TitleCatalog.ALL_BY_CATEGORY.stream()
                .flatMap(List::stream)
                .filter(t -> t.code().equals(code))
                .findFirst();
    }

    /**
     * 칭호 코드(code) 단위로 "지금 값"을 계산한다. 대부분의 카테고리는 카테고리 전체가 같은
     * 값을 공유하므로(예: WORD 카테고리 칭호 11개 전부 "학습한 단어 수" 하나를 본다) 카테고리
     * 값을 그 카테고리의 모든 칭호 코드에 그대로 복사해 넣고, STUDY_METHOD/TIME_OF_DAY처럼
     * 칭호마다 기준이 다른 카테고리만 개별 코드를 덮어쓴다(아래 overrides 블록).
     */
    private Map<String, Long> computeCurrentValues(Long userId) {
        LearningStatsResponse stats = learningStatsService.getStats(userId);
        User user = userRepository.findById(userId).orElse(null);
        long studySeconds = user == null ? 0L : user.getTotalStudySeconds();

        List<WordbookPost> myPosts = wordbookPostRepository.findByAuthorIdOrderByCreatedAtDesc(userId);
        long myPostCommentsTotal = myPosts.stream().mapToLong(WordbookPost::getCommentCount).sum();
        long myPostLikesTotal = myPosts.stream().mapToLong(WordbookPost::getLikeCount).sum();

        Map<TitleCategory, Long> categoryValues = Map.ofEntries(
                Map.entry(TitleCategory.WORD, (long) stats.wordsLearned()),
                Map.entry(TitleCategory.LINE, (long) stats.linesCompleted()),
                Map.entry(TitleCategory.SONG, (long) stats.songsCompleted()),
                Map.entry(TitleCategory.WORDBOOK_ADD, wordbookItemRepository.countByWordbook_User_Id(userId)),
                Map.entry(TitleCategory.STUDY_TIME, studySeconds / 3600),
                Map.entry(TitleCategory.STREAK, (long) stats.longestStreakDays()),
                Map.entry(TitleCategory.POST, (long) myPosts.size()),
                Map.entry(TitleCategory.COMMENT, wordbookPostCommentRepository.countByAuthorId(userId)),
                Map.entry(TitleCategory.WORDBOOK_DOWNLOAD, wordbookRepository.sumDownloadCountByUserId(userId)),
                Map.entry(TitleCategory.MY_POST_COMMENT, myPostCommentsTotal),
                Map.entry(TitleCategory.MY_POST_LIKE, myPostLikesTotal),
                Map.entry(TitleCategory.WORD_REPEAT, (long) userWordProgressRepository.findMaxRepetitionCountByUserId(userId)),
                Map.entry(TitleCategory.SONG_REPEAT, (long) userSongProgressRepository.findMaxCompletedCountByUserId(userId)),
                Map.entry(TitleCategory.DOWNLOAD_RECEIVED, user == null ? 0L : user.getDownloadsReceivedCount())
        );

        Map<String, Long> values = new java.util.HashMap<>();
        for (List<Title> titles : TitleCatalog.ALL_BY_CATEGORY) {
            TitleCategory category = titles.get(0).category();
            long categoryValue = categoryValues.getOrDefault(category, 0L);
            for (Title t : titles) {
                values.put(t.code(), categoryValue);
            }
        }

        // ---- 칭호마다 기준이 다른 카테고리 — 코드 단위로 덮어쓴다 ----
        if (user != null) {
            // STUDY_METHOD: 방법별 5개는 각자 카운트, "올라운더"/"멀티플레이어" 2개는 5개 방법
            // 전부를 고르게 했는지 보는 것이므로 min(5개 카운트) — 어느 하나라도 적으면 병목이 된다.
            values.put("STUDY_METHOD_FLASHCARD_50", user.getStudyFlashcardCount());
            values.put("STUDY_METHOD_QUIZ_50", user.getStudyQuizCount());
            values.put("STUDY_METHOD_FILL_50", user.getStudyFillCount());
            values.put("STUDY_METHOD_REORDER_50", user.getStudyReorderCount());
            values.put("STUDY_METHOD_MATCH_50", user.getStudyMatchCount());
            long allroundMin = java.util.stream.LongStream.of(
                    user.getStudyFlashcardCount(), user.getStudyQuizCount(), user.getStudyFillCount(),
                    user.getStudyReorderCount(), user.getStudyMatchCount()
            ).min().orElse(0L);
            values.put("STUDY_METHOD_ALLROUNDER_10", allroundMin);
            values.put("STUDY_METHOD_ALLROUNDER_50", allroundMin);

            // TIME_OF_DAY: 버킷 4개가 각자 독립적인 값/칭호.
            values.put("TIME_OF_DAY_DAWN_10", user.getStudyDawnCount());
            values.put("TIME_OF_DAY_MORNING_10", user.getStudyMorningCount());
            values.put("TIME_OF_DAY_AFTERNOON_10", user.getStudyAfternoonCount());
            values.put("TIME_OF_DAY_NIGHT_10", user.getStudyNightCount());
        }

        return values;
    }
}
