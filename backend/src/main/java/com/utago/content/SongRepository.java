package com.utago.content;

import com.utago.common.Lang;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SongRepository extends JpaRepository<Song, Long> {

    /** 검색 기반 카탈로그(공개) — PUBLIC + 게시된 곡만, 제목/아티스트로 검색 */
    Page<Song> findByVisibilityAndContentStatusAndTitleContainingIgnoreCase(
            Visibility visibility, ContentStatus contentStatus, String title, Pageable pageable);

    Page<Song> findByVisibilityAndContentStatusAndSourceLang(
            Visibility visibility, ContentStatus contentStatus, Lang sourceLang, Pageable pageable);

    /** 검색어/언어 필터 없이 공개 카탈로그 전체 (기본 목록) */
    Page<Song> findByVisibilityAndContentStatus(Visibility visibility, ContentStatus contentStatus, Pageable pageable);

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
}
