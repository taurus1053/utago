-- ============================================================
-- V2에서 아무 검증 없이 'Vaundy' 로 잘못 표기해 넣었던 더미 곡(第ゼロ感)을 지우고,
-- 화면 확인용으로 실제 쓰고 있던 踊り子(Vaundy)로 교체한다.
--
-- 주의: song_lines의 원문/번역은 여전히 자리표시용 샘플 텍스트다.
-- 저작권이 있는 실제 가사 원문은 Claude가 대신 채워 넣을 수 없어서(가사 재현 정책상 불가),
-- 직접 입력하거나 라이선스 확보 후 별도 마이그레이션/관리자 도구로 채워야 한다.
-- youtube_video_id는 웹 검색으로 찾은 Vaundy 공식 채널 업로드로 추정되는 값이라
-- 실제 동작 전에 한 번 더 확인하는 걸 권장.
-- ============================================================

DELETE FROM songs WHERE title = '第ゼロ感' AND artist = 'Vaundy';

INSERT INTO songs (title, artist, source_lang, youtube_video_id, audio_source_type, content_status, provenance)
VALUES ('踊り子', 'Vaundy', 'JA', 'otjCT46kYNo', 'YOUTUBE', 'PUBLISHED', 'SELF_TYPED');

SET @song_id = LAST_INSERT_ID();

INSERT INTO song_lines (song_id, line_order, original_text, translation_natural, start_ms, end_ms)
VALUES
    (@song_id, 1, '[가사 원문 자리 — 저작권 때문에 자동으로 못 채움, 직접 입력 필요]', '[의역 자리 — 직접 입력 필요]', 0, 3000),
    (@song_id, 2, '[가사 원문 자리 — 저작권 때문에 자동으로 못 채움, 직접 입력 필요]', '[의역 자리 — 직접 입력 필요]', 3000, 6000);
