-- 대댓글(답글) 지원 — claude/소셜_마이페이지_기획.md 24번. 1단계 깊이만 허용한다
-- (답글에는 답글을 달 수 없음, WordbookPostService.addComment()에서 검증).
-- 부모 댓글이 삭제되면 그 답글들도 같이 지워진다(ON DELETE CASCADE) — 부모 없는 답글은
-- 맥락이 없어 의미가 없으므로.
ALTER TABLE wordbook_post_comments
    ADD COLUMN parent_comment_id BIGINT NULL,
    ADD CONSTRAINT fk_wordbook_post_comments_parent FOREIGN KEY (parent_comment_id)
        REFERENCES wordbook_post_comments(id) ON DELETE CASCADE;
