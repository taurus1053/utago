package com.utago.content;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * line_translation_cache와 같은 구조의 "공유 캐시" 서비스 — 다만 키가 텍스트 해시가 아니라
 * (youtube_video_id, line_order)라는 점만 다르다. 곡 등록 시 이미 관리자가 맞춰둔 타이밍이
 * 있으면 그대로 재사용하고, 없는 소절만 기존처럼 균등 분배(4초 간격)로 임시 배정한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SongSyncCacheService {

    private final SongSyncCacheRepository syncCacheRepository;

    /** 곡 등록 시 사용 — 소절 순서(1부터) -> 캐시된 타이밍. 캐시된 게 없으면 빈 Map. */
    public Map<Integer, SongSyncCache> lookupByVideoId(String youtubeVideoId) {
        if (youtubeVideoId == null || youtubeVideoId.isBlank()) {
            return Map.of();
        }
        return syncCacheRepository.findByYoutubeVideoIdOrderByLineOrderAsc(youtubeVideoId).stream()
                .collect(Collectors.toMap(SongSyncCache::getLineOrder, c -> c));
    }

    /**
     * ADMIN이 탭싱크로 맞춘 타이밍을 공유 캐시에 반영(신규 저장 또는 갱신).
     * 소절 순서 기준으로 upsert하며, 기존에 있던 (youtube_video_id, line_order) 조합이면
     * 타이밍만 덮어쓴다.
     */
    @Transactional
    public void upsertAdminBatch(String youtubeVideoId, List<SongLine> lines) {
        if (youtubeVideoId == null || youtubeVideoId.isBlank()) {
            return;
        }
        for (SongLine line : lines) {
            SongSyncCache cache = syncCacheRepository
                    .findByYoutubeVideoIdAndLineOrder(youtubeVideoId, line.getLineOrder())
                    .orElseGet(() -> SongSyncCache.builder()
                            .youtubeVideoId(youtubeVideoId)
                            .lineOrder(line.getLineOrder())
                            .build());
            cache.setStartMs(line.getStartMs());
            cache.setEndMs(line.getEndMs());
            syncCacheRepository.save(cache);
        }
    }
}
