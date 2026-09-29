-- 관리자(ADMIN) 역할 도입.
--
-- 배경: 소절 번역 캐시(line_translation_cache, V8)를 운영진이 직접 검수해서 넣을 수 있는
-- 관리자 페이지가 필요해짐 — 저작권 있는 가사/번역 텍스트를 Claude(AI 어시스턴트)에게
-- 채팅으로 전달하지 않고, 운영진 본인이 로그인해서 직접 입력/관리하는 구조로 간다.
--
-- 기본값은 모든 계정 'USER'. 실제로 누구를 ADMIN으로 승격할지는 이 마이그레이션이
-- 추측하지 않는다(가입 이메일을 알 수 없으므로) — 운영진이 아래처럼 본인 계정에 대해
-- 직접 한 번 실행해서 승격해야 한다:
--   UPDATE users SET role = 'ADMIN' WHERE email = '본인 가입 이메일';

ALTER TABLE users
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'USER' AFTER auth_provider;
