-- word_examples(V1에서 이미 만들어졌지만 지금까지 아무 기능도 쓰지 않던 테이블)를 실제로
-- 쓰기 시작하면서 두 컬럼을 추가한다.
-- tokens_json: example_text를 "단어/조사 단위"로 쪼갠 JSON 배열(예: ["私","は","学校","へ",
--   "行きます"]) — 문장 재배열 게임에서 한 글자씩이 아니라 이 단위로 타일을 만드는 데 쓴다.
--   AI가 예문과 함께 만들어주며, 만들지 못했으면 NULL(그 예문은 재배열엔 못 쓰지만 다른
--   게임엔 여전히 쓸 수 있음).
-- created_at: 언제 생성됐는지(디버깅/운영용, 기능적으로 필수는 아니지만 다른 테이블들과
--   맞춤).
ALTER TABLE word_examples
    ADD COLUMN tokens_json TEXT NULL AFTER source_song_line_id,
    ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER tokens_json;
