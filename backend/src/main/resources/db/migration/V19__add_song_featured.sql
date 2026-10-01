-- 홈 화면 "오늘의 추천곡" — 유튜브 영상이 있는 공개/본인 소유 곡 아무거나가 아니라,
-- 관리자가 직접 "추천곡"으로 지정해둔 곡들 중에서만 무작위로 보여주도록 바꾼다.
ALTER TABLE songs ADD COLUMN featured BOOLEAN NOT NULL DEFAULT FALSE;
