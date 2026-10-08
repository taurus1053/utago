-- 알림 이벤트 확장(대댓글/신고 처리 결과/운영진 공지) — claude/소셜_마이페이지_기획.md 24번.
-- REPORT_RESOLVED/ANNOUNCEMENT는 기존처럼 type만으로 고정 문구를 만들 수 없어서(처리
-- 액션/공지 내용이 매번 다름), 메시지/이동 경로를 직접 담아둘 nullable 컬럼을 추가한다.
-- 기존 4종 타입(FRIEND_REQUEST 등)은 그대로 NotificationService의 switch 문으로 생성되고,
-- 이 두 컬럼이 채워진 알림만 그 값을 그대로 쓴다(NotificationService.toResponse 참고).
ALTER TABLE notifications
    ADD COLUMN custom_message VARCHAR(500) NULL,
    ADD COLUMN custom_target_url VARCHAR(200) NULL;
