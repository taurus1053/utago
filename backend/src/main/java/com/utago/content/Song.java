package com.utago.content;

import com.utago.common.Lang;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "songs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Song {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, length = 255)
    private String artist;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_lang", nullable = false, length = 10)
    private Lang sourceLang;

    @Column(name = "youtube_video_id", length = 20)
    private String youtubeVideoId;

    @Enumerated(EnumType.STRING)
    @Column(name = "audio_source_type", nullable = false, length = 20)
    @Builder.Default
    private AudioSourceType audioSourceType = AudioSourceType.YOUTUBE;

    @Enumerated(EnumType.STRING)
    @Column(name = "content_status", nullable = false, length = 20)
    @Builder.Default
    private ContentStatus contentStatus = ContentStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Provenance provenance;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
