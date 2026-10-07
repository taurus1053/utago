-- 칭호 시스템 남은 카테고리 3종(학습 방법별/학습 시간대/내가 다운로드한 개수) 계측 컬럼.
-- claude/소셜_마이페이지_기획.md 14-2/15-6/16번 — "⚠️ 새 계측 필요"로 분류됐던 항목들.
-- (친구수 FRIEND_COUNT, 장르 GENRE는 이번 라운드 제외 — Friendship 미구현/Song 장르 데이터 없음)

-- 내가 다른 사람의 단어장을 다운로드(복사)한 총 횟수 — "열공 수집가" 등.
ALTER TABLE users ADD COLUMN downloads_received_count BIGINT NOT NULL DEFAULT 0;

-- 학습 방법별(플래시카드/퀴즈/빈칸채우기/문장배열/카드맞추기) 정답 횟수 — "플래시카드 장인",
-- "올라운더"(5개 방법 모두 일정 횟수 이상, currentValue = min(5개 카운트)) 등.
ALTER TABLE users ADD COLUMN study_flashcard_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN study_quiz_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN study_fill_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN study_reorder_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN study_match_count BIGINT NOT NULL DEFAULT 0;

-- 학습 시간대(새벽/아침/오후/야간) 학습 행위 횟수 — "새벽형 학습자" 등. 단어 복습
-- (WordbookService.review)과 가사 진행(SongService.updateSongProgress) 양쪽에서,
-- 그 순간의 시각(LocalTime.now())에 해당하는 버킷을 1씩 늘린다(LearningStatsService 참고).
ALTER TABLE users ADD COLUMN study_dawn_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN study_morning_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN study_afternoon_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN study_night_count BIGINT NOT NULL DEFAULT 0;
