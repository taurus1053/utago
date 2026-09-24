-- ============================================================
-- 개발용 시드 데이터 — GET /api/songs 응답을 눈으로 확인하기 위한 샘플 1곡.
-- 운영 배포 전에는 이 마이그레이션을 지우거나(아직 로컬에만 적용됐다면)
-- 프로필 분기(local 전용)로 옮기는 걸 권장.
-- ============================================================

INSERT INTO songs (title, artist, source_lang, youtube_video_id, audio_source_type, content_status, provenance)
VALUES ('第ゼロ感', 'Vaundy', 'JA', 'e79wPyyAY9E', 'YOUTUBE', 'PUBLISHED', 'SELF_TYPED');

SET @song_id = LAST_INSERT_ID();

INSERT INTO song_lines (song_id, line_order, original_text, translation_natural, start_ms, end_ms)
VALUES
    (@song_id, 1, 'サンプル歌詞1行目', '샘플 가사 첫 줄', 0, 3000),
    (@song_id, 2, 'サンプル歌詞2行目', '샘플 가사 둘째 줄', 3000, 6000);
