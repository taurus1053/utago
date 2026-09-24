-- ============================================================
-- 회원가입 시 "이메일만 먼저 인증 → 이후 비밀번호/닉네임 등 입력" 흐름을 위한 테이블.
-- 아직 계정(users)이 생기기 전 단계라 users 와는 분리해서 관리하고,
-- signup 이 성공하면 해당 행은 삭제한다.
-- ============================================================

CREATE TABLE signup_email_verification (
    email        VARCHAR(255) NOT NULL PRIMARY KEY,
    code         VARCHAR(10)  NOT NULL,
    expires_at   DATETIME     NOT NULL,
    verified     BOOLEAN      NOT NULL DEFAULT FALSE,
    verified_at  DATETIME     NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
