-- 단어 학습 진행 상태(SRS: 복습 횟수/다음 복습일/간격/난이도)를 단어장 항목(wordbook_items)
-- 별로 따로 두지 않고, 사용자+단어 단위로 통합한다. 같은 단어가 여러 단어장(예: 즐겨찾기 +
-- 커스텀 단어장)에 동시에 들어있을 수 있는데, 지금까지는 각 단어장 항목이 자기만의
-- repetition_count/next_review_at 등을 따로 가지고 있어서 한쪽에서 복습해도 다른 쪽(예:
-- 즐겨찾기)에는 전혀 반영되지 않는 문제가 있었다.

CREATE TABLE user_word_progress (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    word_id BIGINT NOT NULL,
    next_review_at DATETIME NULL,
    interval_days INT NOT NULL DEFAULT 1,
    repetition_count INT NOT NULL DEFAULT 0,
    ease_factor DECIMAL(4,2) NOT NULL DEFAULT 2.50,
    status VARCHAR(20) NOT NULL DEFAULT 'LEARNING',
    CONSTRAINT uk_user_word_progress UNIQUE (user_id, word_id),
    CONSTRAINT fk_user_word_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_word_progress_word FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

-- 기존 wordbook_items 중 같은 (user, word) 조합에서 가장 많이 학습된(repetition_count가
-- 가장 큰) 항목의 진행 상태를 그대로 이관한다 — 동률이면 더 최근(id가 큰) 항목 우선.
INSERT INTO user_word_progress (user_id, word_id, next_review_at, interval_days, repetition_count, ease_factor, status)
SELECT user_id, word_id, next_review_at, interval_days, repetition_count, ease_factor, status
FROM (
    SELECT
        wb.user_id AS user_id,
        wi.word_id AS word_id,
        wi.next_review_at,
        wi.interval_days,
        wi.repetition_count,
        wi.ease_factor,
        wi.status,
        ROW_NUMBER() OVER (
            PARTITION BY wb.user_id, wi.word_id
            ORDER BY wi.repetition_count DESC, wi.id DESC
        ) AS rn
    FROM wordbook_items wi
    JOIN wordbooks wb ON wb.id = wi.wordbook_id
) ranked
WHERE rn = 1;

-- 진행 상태의 단일 출처는 이제 user_word_progress이므로, wordbook_items에서는 제거한다
-- (wordbook_items는 이제 "이 단어장에 이 단어가 담겨 있다 + 별표 여부"만 나타낸다).
ALTER TABLE wordbook_items
    DROP COLUMN next_review_at,
    DROP COLUMN interval_days,
    DROP COLUMN repetition_count,
    DROP COLUMN ease_factor,
    DROP COLUMN status;
