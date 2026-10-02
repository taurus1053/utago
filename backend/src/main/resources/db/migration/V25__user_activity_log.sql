-- 학습 통계/스트릭 계측용 — 사용자가 "학습 행위"(단어 복습, 가사 진행)를 한 날짜를
-- 하루에 한 행만 기록한다(uk_activity_user_date). 연속 학습일(스트릭)과 마이페이지
-- 스트릭 캘린더(최근 5주 히트맵)를 여기서 계산한다.
CREATE TABLE user_activity_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    activity_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_activity_user_date UNIQUE (user_id, activity_date),
    CONSTRAINT fk_activity_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_activity_log_user_date ON user_activity_log (user_id, activity_date);
