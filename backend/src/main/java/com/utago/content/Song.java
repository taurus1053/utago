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

    /**
     * 이 곡을 등록한 사용자. PUBLIC 카탈로그 곡(운영진이 올리거나 승격시킨 곡)은
     * 소유자가 없으므로 null일 수 있다. PRIVATE 곡은 항상 값이 있어야 한다.
     */
    @Column(name = "owner_user_id")
    private Long ownerUserId;

    /**
     * 공개 범위. 사용자가 직접 등록한 곡은 항상 PRIVATE로 시작하며(본인만 조회 가능),
     * 저작권 문제가 해결된 곡만 운영진이 PUBLIC으로 승격해 전체 카탈로그에 노출한다.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private Visibility visibility = Visibility.PRIVATE;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /**
     * 홈 화면 "오늘의 추천곡"에 등장할 수 있는지 여부. 관리자가 직접 켜고 끈다(일반 사용자는
     * 접근 불가 — AdminSongController 참고). 유튜브 영상이 있고(썸네일 필요) visibility가
     * 공개인 곡만 실제로 추천 후보에 들어간다(HomeLyricService 참고).
     */
    @Column(nullable = false)
    @Builder.Default
    private boolean featured = false;

    /**
     * 장르(관리자 지정, claude/소셜_마이페이지_기획.md 17-8번). 기존 곡은 전부 null(미지정)로
     * 시작하며, 강제 소급 백필 없음 — 관리자가 "곡 관리" 화면에서 하나씩 지정해나간다.
     * 칭호 "장르"(TitleCategory.GENRE)가 이 값을 기준으로 집계한다.
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private SongGenre genre;
}
