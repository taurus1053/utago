-- ============================================================
-- 우타고 (Utago) — 초기 스키마
-- 4개 도메인: 사용자/설정, 콘텐츠/가사/문법, 사전/단어매핑, 단어장/학습/SRS
-- MySQL 8.x, InnoDB, utf8mb4
-- ============================================================

-- ------------------------------------------------------------
-- 도메인 1. 사용자 · 설정
-- ------------------------------------------------------------

CREATE TABLE users (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(255) NOT NULL,
    nickname        VARCHAR(60)  NOT NULL,
    native_lang     VARCHAR(10)  NOT NULL COMMENT 'KO / JA / EN',
    auth_provider   VARCHAR(30)  NOT NULL COMMENT 'google / apple / email 등',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_settings (
    user_id                     BIGINT PRIMARY KEY,
    dark_mode                   BOOLEAN      NOT NULL DEFAULT FALSE,
    font_size_step               INT         NOT NULL DEFAULT 0 COMMENT '기본 대비 +/- 단계',
    furigana_default_on         BOOLEAN      NOT NULL DEFAULT TRUE,
    spotify_account_linked      VARCHAR(120) NULL,
    apple_music_account_linked  VARCHAR(120) NULL,
    CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_stats (
    user_id                BIGINT PRIMARY KEY,
    total_words_learned    INT      NOT NULL DEFAULT 0,
    current_streak_days    INT      NOT NULL DEFAULT 0,
    longest_streak_days    INT      NOT NULL DEFAULT 0,
    last_active_at         DATETIME NULL,
    CONSTRAINT fk_stats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 도메인 2. 콘텐츠 · 가사 · 문법
-- ------------------------------------------------------------

CREATE TABLE songs (
    id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
    title                VARCHAR(255) NOT NULL,
    artist               VARCHAR(255) NOT NULL,
    source_lang          VARCHAR(10)  NOT NULL COMMENT 'JA / KO / EN',
    youtube_video_id     VARCHAR(20)  NULL,
    audio_source_type    VARCHAR(20)  NOT NULL DEFAULT 'YOUTUBE' COMMENT 'YOUTUBE / SPOTIFY / APPLE',
    content_status       VARCHAR(20)  NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT / IN_REVIEW / PUBLISHED',
    provenance           VARCHAR(30)  NOT NULL COMMENT 'SELF_TYPED / AI_GENERATED / LICENSED',
    created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_songs_status (content_status),
    KEY idx_songs_lang (source_lang)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE song_lines (
    id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
    song_id               BIGINT       NOT NULL,
    line_order            INT          NOT NULL,
    original_text         TEXT         NOT NULL,
    translation_natural   TEXT         NOT NULL COMMENT '의역',
    start_ms              INT          NOT NULL,
    end_ms                INT          NOT NULL,
    CONSTRAINT fk_lines_song FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    KEY idx_lines_song_order (song_id, line_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE song_line_readings (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    song_line_id    BIGINT       NOT NULL,
    target_lang     VARCHAR(10)  NOT NULL COMMENT '보는 사용자의 모국어 기준 (KO/JA/EN)',
    reading_text    TEXT         NOT NULL COMMENT '가타카나 / 한글 발음 / 로마자',
    CONSTRAINT fk_readings_line FOREIGN KEY (song_line_id) REFERENCES song_lines(id) ON DELETE CASCADE,
    UNIQUE KEY uk_readings_line_lang (song_line_id, target_lang)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE grammar_points (
    id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
    song_id                 BIGINT       NOT NULL,
    pattern                 VARCHAR(255) NOT NULL,
    explanation             TEXT         NOT NULL,
    example_song_line_id    BIGINT       NULL,
    CONSTRAINT fk_grammar_song FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    CONSTRAINT fk_grammar_example_line FOREIGN KEY (example_song_line_id) REFERENCES song_lines(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 도메인 3. 사전 · 단어 매핑 (노래와 무관한 마스터 사전)
-- ------------------------------------------------------------

CREATE TABLE words (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    lemma           VARCHAR(120) NOT NULL COMMENT '기본형',
    lang            VARCHAR(10)  NOT NULL,
    reading         VARCHAR(120) NULL COMMENT '사전형 발음',
    pos             VARCHAR(30)  NULL COMMENT '품사',
    jlpt_level      VARCHAR(5)   NULL COMMENT '내부용, 사용자에게 비노출',
    dict_source     VARCHAR(60)  NULL,
    UNIQUE KEY uk_words_lemma_lang (lemma, lang)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE word_meanings (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    word_id         BIGINT       NOT NULL,
    meaning_text    VARCHAR(255) NOT NULL,
    display_order   INT          NOT NULL DEFAULT 0 COMMENT '빈도순 정렬',
    CONSTRAINT fk_meanings_word FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
    KEY idx_meanings_word_order (word_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE word_examples (
    id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
    word_id                 BIGINT      NOT NULL,
    example_text            TEXT        NOT NULL,
    example_translation     TEXT        NOT NULL,
    source_type             VARCHAR(20) NOT NULL DEFAULT 'MASTER' COMMENT 'MASTER / SONG_LINE',
    source_song_line_id     BIGINT      NULL,
    CONSTRAINT fk_examples_word FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
    CONSTRAINT fk_examples_song_line FOREIGN KEY (source_song_line_id) REFERENCES song_lines(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE song_line_words (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    song_line_id        BIGINT NOT NULL,
    word_id             BIGINT NOT NULL,
    char_offset_start   INT    NOT NULL,
    char_offset_end     INT    NOT NULL,
    CONSTRAINT fk_slw_line FOREIGN KEY (song_line_id) REFERENCES song_lines(id) ON DELETE CASCADE,
    CONSTRAINT fk_slw_word FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
    KEY idx_slw_line (song_line_id),
    KEY idx_slw_word (word_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 도메인 4. 단어장 · 학습 · SRS
-- ------------------------------------------------------------

CREATE TABLE wordbooks (
    id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id                 BIGINT       NOT NULL,
    name                    VARCHAR(60)  NOT NULL,
    is_favorite_default     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wordbooks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    KEY idx_wordbooks_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE wordbook_items (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    wordbook_id         BIGINT        NOT NULL,
    word_id             BIGINT        NOT NULL,
    starred             BOOLEAN       NOT NULL DEFAULT FALSE,
    next_review_at      DATETIME      NULL COMMENT 'SRS',
    interval_days       INT           NOT NULL DEFAULT 1 COMMENT 'SRS',
    repetition_count    INT           NOT NULL DEFAULT 0 COMMENT 'SRS',
    ease_factor         DECIMAL(4,2)  NOT NULL DEFAULT 2.50 COMMENT 'SRS (SM-2 단순화)',
    status               VARCHAR(20)  NOT NULL DEFAULT 'LEARNING' COMMENT 'LEARNING / MASTERED',
    CONSTRAINT fk_items_wordbook FOREIGN KEY (wordbook_id) REFERENCES wordbooks(id) ON DELETE CASCADE,
    CONSTRAINT fk_items_word FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
    UNIQUE KEY uk_items_wordbook_word (wordbook_id, word_id),
    KEY idx_items_next_review (next_review_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_song_progress (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id             BIGINT   NOT NULL,
    song_id             BIGINT   NOT NULL,
    last_line_order     INT      NOT NULL DEFAULT 0,
    last_studied_at     DATETIME NULL,
    CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_progress_song FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    UNIQUE KEY uk_progress_user_song (user_id, song_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
