-- 단어장 공유(게시판) 기반 — Phase 1.
--
-- 배경: 마이페이지/게시판 기획(claude/소셜_마이페이지_기획.md) Phase 1 — 단어장을 다른
-- 사용자와 공유하려면 먼저 단어장 자체가 공개 범위를 가질 수 있어야 한다. 곡의
-- visibility(V7__add_song_visibility.sql)와 같은 패턴을 그대로 따른다: 기본은 PRIVATE이고,
-- 사용자가 단어장 "⋮" 메뉴에서 명시적으로 PUBLIC으로 전환해야 한다.
--
-- is_official: 운영진이 올린 공식 단어장(JLPT 프리셋 등) 표시용 배지 플래그.
-- download_count: 몇 번 "내 단어장에 추가"(스냅샷 복사)됐는지 — 추후 게시판 정렬/신뢰도 표시용.
-- emoji: 단어장 카드에 쓰는 아이콘. 기존엔 하드코딩된 책 이모티콘(📘)이었는데, 생성/수정 시
-- 사용자가 고를 수 있도록 컬럼으로 뺀다. 기본값은 기존과 동일하게 📘.

ALTER TABLE wordbooks
    ADD COLUMN visibility     VARCHAR(10) NOT NULL DEFAULT 'PRIVATE' AFTER is_favorite_default,
    ADD COLUMN is_official    BOOLEAN     NOT NULL DEFAULT FALSE AFTER visibility,
    ADD COLUMN download_count INT         NOT NULL DEFAULT 0 AFTER is_official,
    ADD COLUMN emoji          VARCHAR(8)  NOT NULL DEFAULT '📘' AFTER download_count;

CREATE INDEX idx_wordbooks_visibility ON wordbooks (visibility);
