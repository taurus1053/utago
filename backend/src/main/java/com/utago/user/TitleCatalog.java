package com.utago.user;

import java.util.List;

/**
 * 칭호 전체 목록 — claude/소셜_마이페이지_기획.md 15-6번(1차 확장판)을 2026-10-07에 사용자가
 * 다시 구체화한 구간으로 교체한 최종판. 카테고리마다 낮은 조건부터 순서대로 나열돼 있다
 * (TitleService가 "다음 칭호"를 고를 때 이 순서를 그대로 쓴다).
 *
 * 코드(code)는 "{카테고리}_{조건값}" 형태 — 조건값이 서로 다르면 자동으로 고유해진다.
 */
public final class TitleCatalog {

    private TitleCatalog() {
    }

    public static final List<Title> WORD = List.of(
            new Title("WORD_10", TitleCategory.WORD, "단어 입문자", 10, "개"),
            new Title("WORD_50", TitleCategory.WORD, "단어 수습생", 50, "개"),
            new Title("WORD_100", TitleCategory.WORD, "단어 숙련자", 100, "개"),
            new Title("WORD_200", TitleCategory.WORD, "단어 베테랑", 200, "개"),
            new Title("WORD_300", TitleCategory.WORD, "단어 전문가", 300, "개"),
            new Title("WORD_500", TitleCategory.WORD, "단어 마스터", 500, "개"),
            new Title("WORD_1000", TitleCategory.WORD, "서재지기", 1000, "개"),
            new Title("WORD_3000", TitleCategory.WORD, "단어 수집의 달인", 3000, "개"),
            new Title("WORD_5000", TitleCategory.WORD, "대도서관", 5000, "개"),
            new Title("WORD_7500", TitleCategory.WORD, "언어의 현자", 7500, "개"),
            new Title("WORD_10000", TitleCategory.WORD, "만언의 전설", 10000, "개")
    );

    public static final List<Title> LINE = List.of(
            new Title("LINE_5", TitleCategory.LINE, "이야기의 시작", 5, "줄"),
            new Title("LINE_20", TitleCategory.LINE, "가사 탐독가", 20, "줄"),
            new Title("LINE_100", TitleCategory.LINE, "가사 정복자", 100, "줄"),
            new Title("LINE_500", TitleCategory.LINE, "가사 베테랑", 500, "줄"),
            new Title("LINE_1000", TitleCategory.LINE, "천 줄의 시인", 1000, "줄"),
            new Title("LINE_2000", TitleCategory.LINE, "노랫말 항해자", 2000, "줄"),
            new Title("LINE_3000", TitleCategory.LINE, "노랫말 수집가", 3000, "줄"),
            new Title("LINE_4000", TitleCategory.LINE, "가사 마라토너", 4000, "줄"),
            new Title("LINE_5000", TitleCategory.LINE, "운율의 달인", 5000, "줄"),
            new Title("LINE_7500", TitleCategory.LINE, "가사의 현자", 7500, "줄"),
            new Title("LINE_10000", TitleCategory.LINE, "만 줄의 서사시", 10000, "줄")
    );

    public static final List<Title> SONG = List.of(
            new Title("SONG_1", TitleCategory.SONG, "첫 완곡", 1, "곡"),
            new Title("SONG_5", TitleCategory.SONG, "음악 애호가", 5, "곡"),
            new Title("SONG_10", TitleCategory.SONG, "초보 리스너", 10, "곡"),
            new Title("SONG_20", TitleCategory.SONG, "아마추어 리스너", 20, "곡"),
            new Title("SONG_30", TitleCategory.SONG, "전문 리스너", 30, "곡"),
            new Title("SONG_50", TitleCategory.SONG, "플리 메이커", 50, "곡"),
            new Title("SONG_100", TitleCategory.SONG, "백곡 클럽", 100, "곡"),
            new Title("SONG_200", TitleCategory.SONG, "음악의 항해자", 200, "곡"),
            new Title("SONG_300", TitleCategory.SONG, "전설의 리스너", 300, "곡")
    );

    public static final List<Title> WORDBOOK_ADD = List.of(
            new Title("WORDBOOK_ADD_10", TitleCategory.WORDBOOK_ADD, "단어장 입문자", 10, "개"),
            new Title("WORDBOOK_ADD_100", TitleCategory.WORDBOOK_ADD, "단어장 수집가", 100, "개"),
            new Title("WORDBOOK_ADD_300", TitleCategory.WORDBOOK_ADD, "단어장 정리왕", 300, "개"),
            new Title("WORDBOOK_ADD_500", TitleCategory.WORDBOOK_ADD, "단어 서재지기", 500, "개"),
            new Title("WORDBOOK_ADD_1000", TitleCategory.WORDBOOK_ADD, "천 단어 아카이브", 1000, "개"),
            new Title("WORDBOOK_ADD_1500", TitleCategory.WORDBOOK_ADD, "단어장 건축가", 1500, "개"),
            new Title("WORDBOOK_ADD_2000", TitleCategory.WORDBOOK_ADD, "단어 도서관", 2000, "개"),
            new Title("WORDBOOK_ADD_2500", TitleCategory.WORDBOOK_ADD, "단어 박물관", 2500, "개"),
            new Title("WORDBOOK_ADD_3000", TitleCategory.WORDBOOK_ADD, "단어의 바다", 3000, "개"),
            new Title("WORDBOOK_ADD_4000", TitleCategory.WORDBOOK_ADD, "단어 제국", 4000, "개"),
            new Title("WORDBOOK_ADD_5000", TitleCategory.WORDBOOK_ADD, "단어의 전장", 5000, "개")
    );

    /** 하루 30초 하트비트(UserController#studyPing) 누적치를 시간 단위로 바꿔 비교한다. */
    public static final List<Title> STUDY_TIME = List.of(
            new Title("STUDY_TIME_1", TitleCategory.STUDY_TIME, "시작이 반이다", 1, "시간"),
            new Title("STUDY_TIME_5", TitleCategory.STUDY_TIME, "스터디 수습생", 5, "시간"),
            new Title("STUDY_TIME_10", TitleCategory.STUDY_TIME, "스터디 정회원", 10, "시간"),
            new Title("STUDY_TIME_30", TitleCategory.STUDY_TIME, "스터디 우수회원", 30, "시간"),
            new Title("STUDY_TIME_50", TitleCategory.STUDY_TIME, "공부벌레", 50, "시간"),
            new Title("STUDY_TIME_100", TitleCategory.STUDY_TIME, "100시간의 구도자", 100, "시간")
    );

    public static final List<Title> STREAK = List.of(
            new Title("STREAK_3", TitleCategory.STREAK, "작심삼일 타파", 3, "일"),
            new Title("STREAK_7", TitleCategory.STREAK, "일주일 완주", 7, "일"),
            new Title("STREAK_30", TitleCategory.STREAK, "한달의 기적", 30, "일"),
            new Title("STREAK_100", TitleCategory.STREAK, "약속의 백일", 100, "일"),
            new Title("STREAK_200", TitleCategory.STREAK, "성실의 아이콘", 200, "일"),
            new Title("STREAK_365", TitleCategory.STREAK, "365 클럽", 365, "일"),
            new Title("STREAK_730", TitleCategory.STREAK, "전설의 학습자", 730, "일"),
            new Title("STREAK_1095", TitleCategory.STREAK, "불멸의 학습자", 1095, "일")
    );

    public static final List<Title> POST = List.of(
            new Title("POST_1", TitleCategory.POST, "첫 게시글", 1, "개"),
            new Title("POST_10", TitleCategory.POST, "커뮤니티 초심자", 10, "개"),
            new Title("POST_30", TitleCategory.POST, "커뮤니티 단골", 30, "개"),
            new Title("POST_50", TitleCategory.POST, "커뮤니티의 달인", 50, "개"),
            new Title("POST_100", TitleCategory.POST, "백 개의 기록", 100, "개"),
            new Title("POST_300", TitleCategory.POST, "커뮤니티 터줏대감", 300, "개"),
            new Title("POST_500", TitleCategory.POST, "커뮤니티의 역사", 500, "개"),
            new Title("POST_1000", TitleCategory.POST, "천 개의 발자취", 1000, "개")
    );

    public static final List<Title> COMMENT = List.of(
            new Title("COMMENT_1", TitleCategory.COMMENT, "첫 댓글", 1, "개"),
            new Title("COMMENT_5", TitleCategory.COMMENT, "소통 입문자", 5, "개"),
            new Title("COMMENT_10", TitleCategory.COMMENT, "수다쟁이", 10, "개"),
            new Title("COMMENT_30", TitleCategory.COMMENT, "소통의 달인", 30, "개"),
            new Title("COMMENT_50", TitleCategory.COMMENT, "소통왕", 50, "개"),
            new Title("COMMENT_100", TitleCategory.COMMENT, "댓글 백 개 클럽", 100, "개"),
            new Title("COMMENT_500", TitleCategory.COMMENT, "댓글 부자", 500, "개"),
            new Title("COMMENT_1000", TitleCategory.COMMENT, "천 개의 말풍선", 1000, "개"),
            new Title("COMMENT_3000", TitleCategory.COMMENT, "소통 장인", 3000, "개"),
            new Title("COMMENT_5000", TitleCategory.COMMENT, "소통의 신", 5000, "개"),
            new Title("COMMENT_10000", TitleCategory.COMMENT, "만 개의 메아리", 10000, "개")
    );

    /** 내 단어장이 다른 사람에게 다운로드(복사)된 총 횟수(Wordbook.downloadCount 합산). */
    public static final List<Title> WORDBOOK_DOWNLOAD = List.of(
            new Title("WORDBOOK_DOWNLOAD_1", TitleCategory.WORDBOOK_DOWNLOAD, "나눔 입문자", 1, "회"),
            new Title("WORDBOOK_DOWNLOAD_5", TitleCategory.WORDBOOK_DOWNLOAD, "작은 나눔", 5, "회"),
            new Title("WORDBOOK_DOWNLOAD_10", TitleCategory.WORDBOOK_DOWNLOAD, "나눔의 달인", 10, "회"),
            new Title("WORDBOOK_DOWNLOAD_20", TitleCategory.WORDBOOK_DOWNLOAD, "인기 단어장", 20, "회"),
            new Title("WORDBOOK_DOWNLOAD_30", TitleCategory.WORDBOOK_DOWNLOAD, "신뢰받는 큐레이터", 30, "회"),
            new Title("WORDBOOK_DOWNLOAD_50", TitleCategory.WORDBOOK_DOWNLOAD, "나눔의 명장", 50, "회"),
            new Title("WORDBOOK_DOWNLOAD_100", TitleCategory.WORDBOOK_DOWNLOAD, "백 번의 나눔", 100, "회")
    );

    public static final List<Title> MY_POST_COMMENT = List.of(
            new Title("MY_POST_COMMENT_1", TitleCategory.MY_POST_COMMENT, "첫 반응", 1, "개"),
            new Title("MY_POST_COMMENT_10", TitleCategory.MY_POST_COMMENT, "초보 글쟁이", 10, "개"),
            new Title("MY_POST_COMMENT_50", TitleCategory.MY_POST_COMMENT, "인기 글쟁이", 50, "개"),
            new Title("MY_POST_COMMENT_100", TitleCategory.MY_POST_COMMENT, "화제의 중심", 100, "개"),
            new Title("MY_POST_COMMENT_300", TitleCategory.MY_POST_COMMENT, "전문 글쟁이", 300, "개"),
            new Title("MY_POST_COMMENT_500", TitleCategory.MY_POST_COMMENT, "베스트 글쟁이", 500, "개"),
            new Title("MY_POST_COMMENT_1000", TitleCategory.MY_POST_COMMENT, "커뮤니티 인플루언서", 1000, "개")
    );

    /** 2026-10-07 피드백 — "글/작성자" 대신 좋아요(하트)라는 소재 자체로 단계를 쌓는다. */
    public static final List<Title> MY_POST_LIKE = List.of(
            new Title("MY_POST_LIKE_1", TitleCategory.MY_POST_LIKE, "첫 하트", 1, "개"),
            new Title("MY_POST_LIKE_10", TitleCategory.MY_POST_LIKE, "하트 수집가", 10, "개"),
            new Title("MY_POST_LIKE_50", TitleCategory.MY_POST_LIKE, "하트 부자", 50, "개"),
            new Title("MY_POST_LIKE_100", TitleCategory.MY_POST_LIKE, "백 개의 하트", 100, "개"),
            new Title("MY_POST_LIKE_300", TitleCategory.MY_POST_LIKE, "하트의 바다", 300, "개"),
            new Title("MY_POST_LIKE_500", TitleCategory.MY_POST_LIKE, "하트 마스터", 500, "개"),
            new Title("MY_POST_LIKE_1000", TitleCategory.MY_POST_LIKE, "하트의 전설", 1000, "개")
    );

    /** 2026-10-08 신규 — "몇 개를 아느냐"(WORD)가 아니라 "하나를 얼마나 깊이 반복했느냐"를 보는
     * 칭호. currentValue는 유저가 가진 모든 단어 중 가장 많이 반복 학습한 단어 1개의
     * repetitionCount(최댓값) — UserWordProgressRepository 참고. */
    public static final List<Title> WORD_REPEAT = List.of(
            new Title("WORD_REPEAT_3", TitleCategory.WORD_REPEAT, "단어와 친해지기", 3, "회"),
            new Title("WORD_REPEAT_5", TitleCategory.WORD_REPEAT, "복습의 재미", 5, "회"),
            new Title("WORD_REPEAT_10", TitleCategory.WORD_REPEAT, "단어 각인", 10, "회"),
            new Title("WORD_REPEAT_20", TitleCategory.WORD_REPEAT, "완전 암기", 20, "회"),
            new Title("WORD_REPEAT_30", TitleCategory.WORD_REPEAT, "보고 또 보고", 30, "회"),
            new Title("WORD_REPEAT_50", TitleCategory.WORD_REPEAT, "단어 완전정복", 50, "회")
    );

    /** 2026-10-08 신규 — 같은 곡을 처음부터 끝까지 다시 완주할 때마다 1회(UserSongProgress.
     * completedCount). currentValue는 유저가 가장 많이 반복 완주한 곡 1개의 횟수(최댓값). */
    public static final List<Title> SONG_REPEAT = List.of(
            new Title("SONG_REPEAT_2", TitleCategory.SONG_REPEAT, "최애곡 발견", 2, "회"),
            new Title("SONG_REPEAT_5", TitleCategory.SONG_REPEAT, "플레이리스트 단골", 5, "회"),
            new Title("SONG_REPEAT_10", TitleCategory.SONG_REPEAT, "무한반복", 10, "회"),
            new Title("SONG_REPEAT_20", TitleCategory.SONG_REPEAT, "띵곡 인증", 20, "회"),
            new Title("SONG_REPEAT_30", TitleCategory.SONG_REPEAT, "최애곡 장인", 30, "회"),
            new Title("SONG_REPEAT_50", TitleCategory.SONG_REPEAT, "덕후의 증표", 50, "회")
    );

    /** 내가 다른 사람의 단어장을 다운로드(복사)한 총 횟수(User.downloadsReceivedCount, V29).
     * WORDBOOK_DOWNLOAD(내 단어장을 "받아간" 횟수)와는 방향이 반대 — 이건 "내가 받은" 쪽. */
    public static final List<Title> DOWNLOAD_RECEIVED = List.of(
            new Title("DOWNLOAD_RECEIVED_1", TitleCategory.DOWNLOAD_RECEIVED, "첫 다운로드", 1, "개"),
            new Title("DOWNLOAD_RECEIVED_5", TitleCategory.DOWNLOAD_RECEIVED, "열공 준비생", 5, "개"),
            new Title("DOWNLOAD_RECEIVED_10", TitleCategory.DOWNLOAD_RECEIVED, "열공 수집가", 10, "개"),
            new Title("DOWNLOAD_RECEIVED_30", TitleCategory.DOWNLOAD_RECEIVED, "콘텐츠 사냥꾼", 30, "개"),
            new Title("DOWNLOAD_RECEIVED_50", TitleCategory.DOWNLOAD_RECEIVED, "열공 마스터", 50, "개"),
            new Title("DOWNLOAD_RECEIVED_100", TitleCategory.DOWNLOAD_RECEIVED, "백 개의 보물", 100, "개")
    );

    /** 2026-10-08 신규(2차) — 학습 방법별(플래시카드/퀴즈/빈칸채우기/문장배열/카드맞추기) 정답
     * 횟수(User.study*Count, V29). 방법별 5개 칭호는 각각 해당 방법의 카운트만 보고, "올라운더"/
     * "멀티플레이어" 2개는 5개 방법 전부를 고르게 했는지 보기 위해 currentValue를
     * min(5개 카운트)로 계산한다(TitleService.computeCurrentValues 참고) — 어느 방법에서든
     * 기준 횟수 미만이면 그 방법이 병목이 되어 두 칭호 모두 달성되지 않는다. */
    public static final List<Title> STUDY_METHOD = List.of(
            new Title("STUDY_METHOD_FLASHCARD_50", TitleCategory.STUDY_METHOD, "플래시카드 장인", 50, "회"),
            new Title("STUDY_METHOD_QUIZ_50", TitleCategory.STUDY_METHOD, "퀴즈 마스터", 50, "회"),
            new Title("STUDY_METHOD_FILL_50", TitleCategory.STUDY_METHOD, "빈칸의 달인", 50, "회"),
            new Title("STUDY_METHOD_REORDER_50", TitleCategory.STUDY_METHOD, "문장 조립왕", 50, "회"),
            new Title("STUDY_METHOD_MATCH_50", TitleCategory.STUDY_METHOD, "짝맞추기 고수", 50, "회"),
            new Title("STUDY_METHOD_ALLROUNDER_10", TitleCategory.STUDY_METHOD, "올라운더", 10, "회"),
            new Title("STUDY_METHOD_ALLROUNDER_50", TitleCategory.STUDY_METHOD, "멀티플레이어", 50, "회")
    );

    /** 2026-10-08 신규(2차) — 학습한 시각(LocalTime)에 따른 네 버킷(User.study*Count, V29).
     * 네 칭호가 전부 같은 카테고리 안에 있지만 서로 다른 버킷 값을 보므로(카테고리 전체가 같은
     * 값을 공유하는 다른 카테고리와 달리), TitleService가 칭호 코드 단위로 값을 따로 계산해
     * 넣어준다. 각 칭호는 단계 없이 1개씩 — 자정~06시(새벽)/06~12시(아침)/12~18시(오후)/
     * 18~24시(야간) 중 그 시간대에 학습한 횟수가 10회 이상이면 달성. */
    public static final List<Title> TIME_OF_DAY = List.of(
            new Title("TIME_OF_DAY_DAWN_10", TitleCategory.TIME_OF_DAY, "새벽형 학습자", 10, "회"),
            new Title("TIME_OF_DAY_MORNING_10", TitleCategory.TIME_OF_DAY, "아침형 학습자", 10, "회"),
            new Title("TIME_OF_DAY_AFTERNOON_10", TitleCategory.TIME_OF_DAY, "오후형 학습자", 10, "회"),
            new Title("TIME_OF_DAY_NIGHT_10", TitleCategory.TIME_OF_DAY, "야행성 학습자", 10, "회")
    );

    /** 2026-10-08 신규(3차) — 장르(Song.genre, V30)별 완곡 수. 장르 하나당 칭호 1개, 그
     * 장르의 곡을 5곡 완주하면 달성(완주 판정은 SONG 카테고리와 동일한 기준 — "가사를 끝까지
     * + 단어를 실제로 학습한 적 있음", LearningStatsService.countCompletedSongsByGenre 참고).
     * 장르가 늘어나면(SongGenre enum 추가) 여기도 같이 추가해야 한다. */
    public static final List<Title> GENRE = List.of(
            new Title("GENRE_KPOP_5", TitleCategory.GENRE, "K-POP 러버", 5, "곡"),
            new Title("GENRE_JPOP_5", TitleCategory.GENRE, "J-POP 러버", 5, "곡"),
            new Title("GENRE_POP_5", TitleCategory.GENRE, "팝 마니아", 5, "곡"),
            new Title("GENRE_BALLAD_5", TitleCategory.GENRE, "발라드 감성러", 5, "곡"),
            new Title("GENRE_ROCK_5", TitleCategory.GENRE, "록 스피릿", 5, "곡"),
            new Title("GENRE_DANCE_EDM_5", TitleCategory.GENRE, "댄스 플로어 메이커", 5, "곡"),
            new Title("GENRE_HIPHOP_RNB_5", TitleCategory.GENRE, "힙합 리스너", 5, "곡"),
            new Title("GENRE_CITY_POP_5", TitleCategory.GENRE, "시티팝 러버", 5, "곡"),
            new Title("GENRE_ACOUSTIC_FOLK_5", TitleCategory.GENRE, "어쿠스틱 힐링러", 5, "곡"),
            new Title("GENRE_JAZZ_SOUL_5", TitleCategory.GENRE, "재즈 소울메이트", 5, "곡"),
            new Title("GENRE_TROT_5", TitleCategory.GENRE, "트로트 명인", 5, "곡"),
            new Title("GENRE_OST_5", TitleCategory.GENRE, "사운드트랙 덕후", 5, "곡"),
            new Title("GENRE_ANIME_5", TitleCategory.GENRE, "애니송 마스터", 5, "곡"),
            new Title("GENRE_VOCALOID_5", TitleCategory.GENRE, "보컬로이드 프로듀서", 5, "곡"),
            new Title("GENRE_AI_5", TitleCategory.GENRE, "AI 송 얼리어답터", 5, "곡")
    );

    /** TitleService가 카테고리 순서대로 순회할 때 쓰는 전체 목록. 자동 착용 기본값을 고를 때도
     * 이 순서(단어 → 가사 → 곡 → ... )를 우선순위로 쓴다. */
    public static final List<List<Title>> ALL_BY_CATEGORY = List.of(
            WORD, LINE, SONG, WORDBOOK_ADD, STUDY_TIME, STREAK,
            POST, COMMENT, WORDBOOK_DOWNLOAD, MY_POST_COMMENT, MY_POST_LIKE,
            WORD_REPEAT, SONG_REPEAT,
            DOWNLOAD_RECEIVED, STUDY_METHOD, TIME_OF_DAY, GENRE
    );
}
