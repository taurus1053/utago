-- ============================================================
-- 이메일+비밀번호 회원가입/로그인을 위한 컬럼 추가.
-- password_hash 는 NULL 허용 — 나중에 붙일 소셜 로그인(구글/애플) 계정은
-- 비밀번호가 없기 때문 (auth_provider 로 구분).
-- ============================================================

ALTER TABLE users
    ADD COLUMN password_hash VARCHAR(255) NULL COMMENT '이메일 가입 시에만 사용, 소셜 로그인 계정은 NULL' AFTER email,
    ADD COLUMN birth_date DATE NULL AFTER native_lang,
    ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER auth_provider,
    ADD COLUMN verification_code VARCHAR(10) NULL,
    ADD COLUMN verification_code_expires_at DATETIME NULL;
