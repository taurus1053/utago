-- 단어장 둘러보기 게시판 — Phase 2.
--
-- 배경: 마이페이지/게시판 기획(claude/소셜_마이페이지_기획.md) 2번 항목. 단어장(Wordbook)을
-- 공개(PUBLIC)로 바꾸는 것만으로는 다른 사용자가 발견할 방법이 없어서, 제목/본문을 붙여
-- 게시물로 올리고 댓글·좋아요를 다는 게시판을 추가한다. JLPT 프리셋 단어장도 운영진이
-- is_official=true로 올린 게시물로 자연스럽게 흡수된다(별도 카탈로그 화면 불필요).
--
-- download_count는 일부러 넣지 않는다 — 게시글당 단어장이 정확히 하나씩 붙어있으므로
-- wordbooks.download_count를 그대로 보여주면 되고, 별도 카운터를 두면 두 값이 어긋날
-- 위험만 생긴다(동기화 버그의 흔한 원인).
CREATE TABLE wordbook_posts (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    wordbook_id     BIGINT       NOT NULL,
    author_user_id  BIGINT       NOT NULL,
    title           VARCHAR(100) NOT NULL,
    body            TEXT         NOT NULL,
    is_official     BOOLEAN      NOT NULL DEFAULT FALSE,
    like_count      INT          NOT NULL DEFAULT 0,
    comment_count   INT          NOT NULL DEFAULT 0,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wordbook_posts_wordbook FOREIGN KEY (wordbook_id) REFERENCES wordbooks(id),
    CONSTRAINT fk_wordbook_posts_author FOREIGN KEY (author_user_id) REFERENCES users(id),
    KEY idx_wordbook_posts_official_created (is_official, created_at),
    KEY idx_wordbook_posts_like_count (like_count),
    KEY idx_wordbook_posts_author (author_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 게시글이 지워지면 댓글/좋아요도 함께 지운다(ON DELETE CASCADE) — 고아 행이 남을 이유가 없음.
CREATE TABLE wordbook_post_comments (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id         BIGINT       NOT NULL,
    author_user_id  BIGINT       NOT NULL,
    content         VARCHAR(500) NOT NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wordbook_post_comments_post FOREIGN KEY (post_id) REFERENCES wordbook_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_wordbook_post_comments_author FOREIGN KEY (author_user_id) REFERENCES users(id),
    KEY idx_wordbook_post_comments_post (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE wordbook_post_likes (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id     BIGINT   NOT NULL,
    user_id     BIGINT   NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_wordbook_post_likes_post_user UNIQUE (post_id, user_id),
    CONSTRAINT fk_wordbook_post_likes_post FOREIGN KEY (post_id) REFERENCES wordbook_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_wordbook_post_likes_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
