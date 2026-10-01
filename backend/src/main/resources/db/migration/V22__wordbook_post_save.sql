-- 게시글 상세 "저장" 기능 — 기획(claude/소셜_마이페이지_기획.md) 2-1 WordbookPostSave.
--
-- 폴더별 분류(SavedPostFolder)는 마이페이지의 "저장한 게시글" 화면과 함께 나중에 추가한다
-- (아직 그 화면이 없어서 폴더 UI를 둘 곳이 없음). 지금은 게시글 상세의 단순 저장/저장 취소
-- 토글만 지원 — folder_id 없이도 "저장했는지 여부"는 그대로 동작하고, 나중에 폴더 기능을
-- 붙일 때 nullable 컬럼으로 추가하면 된다(기존 행은 전부 "미분류"로 남음).
CREATE TABLE wordbook_post_saves (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id     BIGINT   NOT NULL,
    user_id     BIGINT   NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_wordbook_post_saves_post_user UNIQUE (post_id, user_id),
    CONSTRAINT fk_wordbook_post_saves_post FOREIGN KEY (post_id) REFERENCES wordbook_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_wordbook_post_saves_user FOREIGN KEY (user_id) REFERENCES users(id),
    KEY idx_wordbook_post_saves_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
