-- 닉네임 중복확인 기능이 의미 있으려면 DB 레벨에서도 유일해야 함.
ALTER TABLE users
    ADD UNIQUE KEY uk_users_nickname (nickname);
