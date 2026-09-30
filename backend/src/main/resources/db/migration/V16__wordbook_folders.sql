-- 단어장을 폴더로 묶어서 정리할 수 있게 한다. 폴더는 즐겨찾기 기본 단어장과 무관하게
-- 유저별로 여러 개 만들 수 있고, 단어장은 폴더에 안 넣고 그냥 만들 수도 있다(folder_id NULL).
CREATE TABLE wordbook_folders (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    name        VARCHAR(60)  NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wordbook_folders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    KEY idx_wordbook_folders_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 폴더를 지워도 그 안의 단어장 자체는 안 지워지고 "폴더 없음" 상태로 남는다(ON DELETE SET NULL).
ALTER TABLE wordbooks ADD COLUMN folder_id BIGINT NULL AFTER user_id;
ALTER TABLE wordbooks ADD CONSTRAINT fk_wordbooks_folder FOREIGN KEY (folder_id) REFERENCES wordbook_folders(id) ON DELETE SET NULL;
ALTER TABLE wordbooks ADD KEY idx_wordbooks_folder (folder_id);
