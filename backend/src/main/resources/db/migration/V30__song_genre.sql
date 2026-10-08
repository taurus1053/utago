-- 곡 장르(관리자가 지정) — claude/소셜_마이페이지_기획.md 17-8번(장르 칭호) 참고.
-- NULL 허용: 기존 곡은 전부 미지정 상태로 시작하고, 관리자가 "곡 관리" 화면에서
-- 하나씩 지정해나간다(강제 소급 백필 없음).
ALTER TABLE songs ADD COLUMN genre VARCHAR(30) NULL;
