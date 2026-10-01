package com.utago.content;

import com.utago.common.Lang;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SongRepository extends JpaRepository<Song, Long> {

    /**
     * 검색 기반 카탈로그(공개) — PUBLIC + 게시 + AI_GENERATED(AI 학습곡)만, 제목/아티스트로 검색.
     * 저작권 문제로 일반 사용자가 등록한 곡을 공개 카탈로그로 승격하는 기능은 당분간 쓰지 않고,
     * 관리자가 직접 만든 AI 학습곡만 "전체 곡"에 노출한다(SongService.listSongs 참고).
     */
    Page<Song> findByVisibilityAndContentStatusAndProvenanceAndTitleContainingIgnoreCase(
            Visibility visibility, ContentStatus contentStatus, Provenance provenance, String title, Pageable pageable);

    Page<Song> findByVisibilityAndContentStatusAndProvenanceAndSourceLang(
            Visibility visibility, ContentStatus contentStatus, Provenance provenance, Lang sourceLang, Pageable pageable);

    /** 검색어/언어 필터 없이 AI 학습곡 전체 (기본 목록) */
    Page<Song> findByVisibilityAndContentStatusAndProvenance(
            Visibility visibility, ContentStatus contentStatus, Provenance provenance, Pageable pageable);

    /** 마이페이지 - 내가 등록한 곡 목록(공개 범위 무관, 전부 내 것) */
    Page<Song> findByOwnerUserIdOrderByCreatedAtDesc(Long ownerUserId, Pageable pageable);

    /**
     * 곡 추가 화면 - 같은 유튜브 영상으로 이미 등록된 곡이 있는지 확인.
     * 공개 카탈로그(PUBLIC) 이거나, 요청한 사용자 본인의 PRIVATE 곡만 "이미 있음"으로 취급한다
     * (다른 사용자의 PRIVATE 곡은 존재 자체를 알려주지 않는다).
     */
    Optional<Song> findFirstByYoutubeVideoIdAndVisibilityAndContentStatus(
            String youtubeVideoId, Visibility visibility, ContentStatus contentStatus);

    Optional<Song> findFirstByYoutubeVideoIdAndOwnerUserId(String youtubeVideoId, Long ownerUserId);

    /** 곡 추가 화면 - 다른 영상이라도 제목+아티스트가 같은(이미 가사가 있는) 공개 곡이 있는지 확인 */
    Optional<Song> findByVisibilityAndContentStatusAndTitleIgnoreCaseAndArtistIgnoreCase(
            Visibility visibility, ContentStatus contentStatus, String title, String artist);

    /** 발음 표기 백필 등 배치 작업용 — 특정 원어의 곡 전체 조회(공개 범위 무관) */
    List<Song> findBySourceLang(Lang sourceLang);

    /**
     * 홈 화면 "오늘의 추천곡" — 가사 소절 텍스트가 아니라 "곡 자체"를 무작위로 추천한다
     * (저작권 문제로 가사 원문/번역을 비로그인·비학습 사용자에게까지 노출하지 않기로 함 —
     * HomeLyricService 참고). 아무 공개 곡이나 뽑는 게 아니라, 관리자가 미리 featured=true로
     * 지정해둔 곡들 중에서만 고른다(AdminSongController의 추천곡 관리 API 참고). 유튜브
     * 영상이 있는 곡만 대상(썸네일/바로 재생을 위해 필요). 다른 사용자의 PRIVATE 곡이
     * 섞이지 않도록 예문 조회와 같은 가시성 규칙을 쓴다(원칙적으로 추천곡은 공개곡이어야
     * 하지만, 혹시 모를 데이터 꼬임에 대비한 안전장치).
     */
    @Query(value = "SELECT s.* FROM songs s " +
            "WHERE s.featured = TRUE AND s.youtube_video_id IS NOT NULL " +
            "AND ((s.visibility = 'PUBLIC' AND s.content_status = 'PUBLISHED') OR s.owner_user_id = :userId) " +
            "ORDER BY RAND() LIMIT 1", nativeQuery = true)
    Optional<Song> findRandomFeaturedSong(@Param("userId") Long userId);

    /**
     * 관리자 "추천곡 관리" 화면 — 제목/아티스트로 곡을 검색한다(추천곡으로 지정할 곡을
     * 찾기 위함이라, 일반 사용자 화면과 달리 공개 범위 상관없이 전체 곡에서 검색한다).
     * 결과가 너무 많아지지 않도록 상위 20개로 제한.
     */
    List<Song> findTop20ByTitleContainingIgnoreCaseOrArtistContainingIgnoreCase(String title, String artist);

    /** 관리자 "추천곡 관리" 화면 — 현재 추천곡으로 지정된 곡 전체 목록 */
    List<Song> findByFeaturedTrueOrderByTitleAsc();
}
