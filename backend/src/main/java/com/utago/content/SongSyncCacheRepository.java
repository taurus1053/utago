package com.utago.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SongSyncCacheRepository extends JpaRepository<SongSyncCache, Long> {

    /** 곡 등록 시 — 이 유튜브 영상에 이미 관리자가 맞춰둔 타이밍이 있는지 소절 순서대로 조회 */
    List<SongSyncCache> findByYoutubeVideoIdOrderByLineOrderAsc(String youtubeVideoId);

    Optional<SongSyncCache> findByYoutubeVideoIdAndLineOrder(String youtubeVideoId, int lineOrder);
}
