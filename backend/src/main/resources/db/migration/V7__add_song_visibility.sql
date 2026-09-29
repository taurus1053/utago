-- 곡의 공개 범위(visibility) 도입.
--
-- 배경: 여러 사용자가 함께 쓰는 서비스로 가되, 사용자가 직접 입력한(저작권 있는) 가사를
-- 다른 사용자에게 무단으로 노출하지 않기 위해 "곡은 등록자 본인만 보는 PRIVATE이 기본값이고,
-- 저작권 문제가 해결된 곡만 운영진이 PUBLIC으로 승격해 전체 공개 카탈로그에 올린다"는
-- 구조로 바꾼다. 즉 서비스 가입자는 여러 명이어도, 각자 자기가 입력한 가사는 자기 계정에만
-- 귀속되고 서로 공유되지 않는다(라이선스 확보 전까지).

ALTER TABLE songs
    ADD COLUMN owner_user_id BIGINT NULL AFTER provenance,
    ADD COLUMN visibility VARCHAR(10) NOT NULL DEFAULT 'PRIVATE' AFTER owner_user_id;

ALTER TABLE songs
    ADD CONSTRAINT fk_songs_owner_user
        FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE;

CREATE INDEX idx_songs_owner_user_id ON songs (owner_user_id);

-- 기존에 V6에서 넣은 踊り子(Vaundy) 시드 곡은 운영진이 올린 공식 카탈로그 항목이므로
-- 소유자 없이 PUBLIC으로 전환한다. (가사 본문은 여전히 저작권 문제로 플레이스홀더 상태 —
-- V6 마이그레이션 주석 참고. 실제 서비스에 노출하려면 가사를 합법적으로 확보해서 채워야 함)
UPDATE songs
SET visibility = 'PUBLIC', owner_user_id = NULL
WHERE youtube_video_id = 'otjCT46kYNo';
