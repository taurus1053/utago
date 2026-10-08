-- 신고 처리 액션(작성자 경고/정지) 원천 데이터 — claude/소셜_마이페이지_기획.md 23번,
-- ReportService.resolveReport() 참고. warning_count는 그냥 누적 카운트만(경고 3회 시
-- 자동 정지 같은 추가 정책은 아직 없음, 운영진이 직접 보고 판단). suspended_until이
-- NULL이 아니고 현재보다 미래면 로그인 자체가 막힌다(AuthService.login()).
ALTER TABLE users
    ADD COLUMN warning_count INT NOT NULL DEFAULT 0,
    ADD COLUMN suspended_until DATETIME NULL;
