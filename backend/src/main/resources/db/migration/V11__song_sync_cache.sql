-- 소절별 재생 타이밍(가사 싱크)을 유튜브 영상 단위로 공유 재사용하기 위한 캐시 테이블.
-- line_translation_cache와 달리 원문 텍스트가 아니라 (youtube_video_id, line_order)로 키를
-- 잡는다 — 후렴구처럼 같은 가사가 여러 번 나와도 등장 위치마다 실제 타임스탬프가 다르기
-- 때문에, 텍스트 내용이 아니라 "몇 번째 영상의 몇 번째 소절"이 곧 키가 되어야 한다.
CREATE TABLE song_sync_cache (
    id BIGINT NOT NULL AUTO_INCREMENT,
    youtube_video_id VARCHAR(20) NOT NULL,
    line_order INT NOT NULL,
    start_ms INT NOT NULL,
    end_ms INT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_song_sync_cache_video_line (youtube_video_id, line_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
