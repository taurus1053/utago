-- KanaToHangulConverter의 장음부호(ー) 처리 버그(완성되지 않은 한글 낱자를 그대로 붙여서
-- "스토ㅗ리ㅣ"처럼 글자가 깨져 보이던 문제)를 고친 뒤, 이미 저장된 한국어 발음 표기는
-- 버그가 있던 버전으로 생성된 것이라 고쳐지지 않는다 — 전부 지워서 다음 서버 기동 시
-- SongLineReadingBackfillRunner가 고쳐진 변환기로 다시 채우게 한다(멱등적이라 안전).
DELETE FROM song_line_readings WHERE target_lang = 'KO';
