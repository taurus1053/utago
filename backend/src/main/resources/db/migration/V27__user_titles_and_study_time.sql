-- 칭호 시스템 실제 구현(claude/소셜_마이페이지_기획.md 15-6번 확장판) + 누적 학습시간 계측.
--
-- 칭호 자체(이름/카테고리/조건값)는 DB 테이블이 아니라 백엔드 코드(TitleCatalog)에 정적으로
-- 정의한다 — 사용자가 직접 만드는 데이터가 아니라 앱이 정의하는 고정 목록이고, "달성 여부"도
-- 매번 현재 통계와 비교해서 실시간으로 계산하면 되므로 별도 이력 테이블이 필요 없다. 그래서
-- users 테이블에는 "지금 착용 중인 칭호 코드"만 저장하면 충분하다.
ALTER TABLE users ADD COLUMN equipped_title_code VARCHAR(60) NULL;

-- 누적 학습시간 칭호(1/5/10/30/50/100시간)를 위한 총 학습 시간(초) 누적 컬럼. 학습 화면에서
-- 주기적으로(약 30초 간격) 보내는 하트비트로 조금씩 늘어난다(UserProfileService.addStudySeconds).
ALTER TABLE users ADD COLUMN total_study_seconds BIGINT NOT NULL DEFAULT 0;
