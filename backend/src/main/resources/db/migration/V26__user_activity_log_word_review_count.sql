-- 마이페이지 스트릭 캘린더를 "그날 학습했는지(불린)"에서 "그날 단어를 얼마나 복습
-- 했는지(단어 학습량)"로 보여주기 위한 카운터. 단어 복습(WordbookService.review())이
-- 일어날 때마다 오늘 행의 word_review_count를 1씩 늘린다(행이 없으면 새로 만들면서 1로
-- 시작) — user_activity_log.sql(V25)의 "하루 1행" 멱등성은 그대로 유지하면서, 그 행 안에
-- 그날의 복습 횟수만 추가로 센다. 가사 진행(updateSongProgress)은 이 카운터를 올리지
-- 않는다 — "단어 학습량"이라는 요구사항에 맞춰 단어 복습만 집계한다.
ALTER TABLE user_activity_log
    ADD COLUMN word_review_count INT NOT NULL DEFAULT 0;
