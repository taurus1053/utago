-- 게시판 신고/모더레이션 — claude/소셜_마이페이지_기획.md 23번. 게시글/댓글 둘 다 신고
-- 가능. post_id/comment_id는 ON DELETE SET NULL — 신고 처리 중 콘텐츠가 삭제돼도(신고
-- 처리로 삭제했든, 그 사이 작성자가 직접 지웠든) 이 신고 행 자체는 감사 기록으로 남아야
-- 하므로 CASCADE 대신 SET NULL을 쓰고, 어떤 글/댓글이었는지는 target_snapshot에 생성
-- 시점의 제목/본문 일부를 그대로 박제해둔다. target_author_id도 같은 이유로 스냅샷(신고
-- 시점의 작성자) — 작성자 경고/정지 처리는 콘텐츠가 사라진 뒤에도 할 수 있어야 한다.
CREATE TABLE reports (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    reporter_id     BIGINT      NOT NULL,
    target_type     VARCHAR(20) NOT NULL,
    post_id         BIGINT      NULL,
    comment_id      BIGINT      NULL,
    target_author_id BIGINT     NOT NULL,
    target_snapshot VARCHAR(200) NOT NULL,
    reason          VARCHAR(30) NOT NULL,
    detail          VARCHAR(500) NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    action          VARCHAR(30) NOT NULL DEFAULT 'NONE',
    created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at     DATETIME    NULL,
    resolved_by_id  BIGINT      NULL,
    CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_reports_post FOREIGN KEY (post_id) REFERENCES wordbook_posts(id) ON DELETE SET NULL,
    CONSTRAINT fk_reports_comment FOREIGN KEY (comment_id) REFERENCES wordbook_post_comments(id) ON DELETE SET NULL,
    CONSTRAINT fk_reports_target_author FOREIGN KEY (target_author_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_reports_resolved_by FOREIGN KEY (resolved_by_id) REFERENCES users(id) ON DELETE SET NULL,
    KEY idx_reports_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
