package com.utago.content;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * 유튜브 영상 단위로 공유되는 소절 타이밍(가사 싱크) 캐시. (youtube_video_id, line_order)
 * 조합이 유일 키 — 같은 영상으로 곡을 새로 등록하는 모든 사용자가 이 타이밍을 그대로
 * 재사용한다(line_translation_cache가 번역을 재사용하는 것과 같은 구조).
 *
 * ADMIN이 직접 탭싱크로 맞춘 타이밍만 여기 저장된다 — 일반 사용자가 자기 곡의 타이밍을
 * 고쳐도 본인 SongLine에만 반영되고, 이 공유 캐시는 건드리지 않는다.
 */
@Entity
@Table(name = "song_sync_cache",
        uniqueConstraints = @UniqueConstraint(name = "uq_song_sync_cache_video_line",
                columnNames = {"youtube_video_id", "line_order"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SongSyncCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "youtube_video_id", nullable = false, length = 20)
    private String youtubeVideoId;

    @Column(name = "line_order", nullable = false)
    private int lineOrder;

    @Column(name = "start_ms", nullable = false)
    private int startMs;

    @Column(name = "end_ms", nullable = false)
    private int endMs;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
