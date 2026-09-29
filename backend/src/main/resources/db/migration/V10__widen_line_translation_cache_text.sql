-- 어드민 페이지에서 여러 소절(또는 곡 전체 가사)을 한 번에 붙여넣어 저장할 때
-- 기존 TEXT 컬럼(최대 약 65,535바이트)으로는 부족한 경우가 있어(예: "Data too long for
-- column 'original_text'") LONGTEXT로 넓힌다.

ALTER TABLE line_translation_cache MODIFY COLUMN original_text LONGTEXT NOT NULL;
ALTER TABLE line_translation_cache MODIFY COLUMN translation_text LONGTEXT NOT NULL;
