-- 칭호 "같은 곡 복습"(TitleCategory.SONG_REPEAT)을 위한 곡 완주 횟수 계측.
--
-- completed_count: 이 곡을 처음부터 끝까지 완주한 누적 횟수(2026-10-08 사용자 확정 —
--   "가사를 끝까지 다시 완주할 때마다" +1). 1회차 완료도 포함되므로, "복습했다"고 볼 수 있는
--   시점(=완주 2회째)부터 칭호 조건(SONG_REPEAT_2)을 건다.
-- completed_this_pass: 같은 완주를 중복 집계하지 않기 위한 내부 플래그. 처음(0번 줄)으로
--   돌아가면 풀려서 다음 완주를 다시 셀 수 있다. SongService#updateSongProgress 참고.
ALTER TABLE user_song_progress ADD COLUMN completed_count INT NOT NULL DEFAULT 0;
ALTER TABLE user_song_progress ADD COLUMN completed_this_pass BOOLEAN NOT NULL DEFAULT FALSE;
