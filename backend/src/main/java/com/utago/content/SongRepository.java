package com.utago.content;

import com.utago.common.Lang;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SongRepository extends JpaRepository<Song, Long> {

    /** 검색 기반 카탈로그 — 게시된 곡만, 제목/아티스트로 검색 */
    Page<Song> findByContentStatusAndTitleContainingIgnoreCase(
            ContentStatus contentStatus, String title, Pageable pageable);

    Page<Song> findByContentStatusAndSourceLang(
            ContentStatus contentStatus, Lang sourceLang, Pageable pageable);

    /** 검색어/언어 필터 없이 게시된 곡 전체 (기본 목록) */
    Page<Song> findByContentStatus(ContentStatus contentStatus, Pageable pageable);
}
