package com.utago.user;

/**
 * 칭호 카테고리 — claude/소셜_마이페이지_기획.md 15-6번(1차)을 사용자가 2026-10-07에 더
 * 구체화한 구간으로 교체. label은 마이페이지 칭호 컬렉션 카드의 그룹 제목으로 쓴다.
 */
public enum TitleCategory {
    WORD("단어"),
    LINE("가사"),
    SONG("곡"),
    WORDBOOK_ADD("단어장 추가"),
    STUDY_TIME("누적 학습시간"),
    STREAK("연속 학습일"),
    POST("게시글"),
    COMMENT("댓글"),
    WORDBOOK_DOWNLOAD("단어장 다운로드"),
    MY_POST_COMMENT("내 글 댓글"),
    MY_POST_LIKE("내 글 좋아요"),
    // 2026-10-08 추가 — "같은 항목을 얼마나 반복했는지"(숫자가 아니라 깊이를 보는 칭호).
    // currentValue는 그 유저가 가장 많이 반복한 단어 1개/곡 1개의 반복 횟수(최댓값)다.
    WORD_REPEAT("같은 단어 복습"),
    SONG_REPEAT("같은 곡 복습"),
    // 2026-10-08 추가(2차) — 14-2/15-6에서 "⚠️ 새 계측 필요"였던 항목 중 3종. 이 세 카테고리는
    // 같은 카테고리 안에서도 칭호마다 기준값이 다르다(예: STUDY_METHOD는 칭호별로 "어떤 방법"인지가
    // 다름) — TitleService.computeCurrentValues()가 카테고리 단위가 아니라 칭호 코드(code) 단위로
    // 값을 계산해서 넣어준다(다른 카테고리는 여전히 카테고리 전체가 같은 값을 공유).
    DOWNLOAD_RECEIVED("받은 단어장"),
    STUDY_METHOD("학습 방법"),
    TIME_OF_DAY("학습 시간대"),
    // 2026-10-08 추가(3차) — 곡 장르(Song.genre, V30)별 완곡 수. STUDY_METHOD/TIME_OF_DAY와
    // 같은 이유로 칭호마다 기준(장르)이 다르므로 TitleService가 코드 단위로 값을 계산한다.
    GENRE("장르");

    private final String label;

    TitleCategory(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
