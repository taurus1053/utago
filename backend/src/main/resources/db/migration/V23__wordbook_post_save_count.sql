-- 게시판 목록 카드에 저장 수를 바로 보여주기 위한 캐시 컬럼 — like_count/comment_count와
-- 같은 패턴(WordbookPostService.toggleSave에서 직접 증감, V22의 wordbook_post_saves가
-- 실제 저장 여부의 근거 테이블).
ALTER TABLE wordbook_posts
    ADD COLUMN save_count INT NOT NULL DEFAULT 0 AFTER comment_count;
