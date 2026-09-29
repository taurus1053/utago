-- 원문 소절 단위 번역 캐시.
--
-- "AI 번역 초안 받기"를 부를 때, 같은 원문 줄(같은 언어)이 이미 번역된 적이 있으면
-- (운영진이 미리 직접 넣어둔 검수 번역이거나, 예전에 실제로 Claude가 번역해서 저장해둔
-- 결과) 캐시를 그대로 재사용하고, 캐시에 없는 줄만 실제로 AI를 호출한다.
--
-- 원문 텍스트에 직접 유니크 인덱스를 걸 수 없어서(TEXT 컬럼) SHA-256 해시 컬럼을 따로 둔다.

CREATE TABLE line_translation_cache (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_lang       VARCHAR(8)  NOT NULL,
    text_hash         VARCHAR(64) NOT NULL,
    original_text     TEXT        NOT NULL,
    translation_text  TEXT        NOT NULL,
    source            VARCHAR(8)  NOT NULL,
    created_at        DATETIME(6) NOT NULL,
    CONSTRAINT uq_line_translation_cache_lang_hash UNIQUE (source_lang, text_hash)
);
