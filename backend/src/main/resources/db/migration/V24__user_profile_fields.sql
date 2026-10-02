-- 마이페이지 프로필(claude/소셜_마이페이지_기획.md 5번, 9-3) — 아바타 기본값은 랜덤
-- 파스텔 단색(회원가입 시 배정, AuthService.signup 참고)과 상태 메시지 한 줄.
ALTER TABLE users
    ADD COLUMN avatar_color   VARCHAR(10) NULL AFTER nickname,
    ADD COLUMN status_message VARCHAR(80) NULL AFTER avatar_color;
