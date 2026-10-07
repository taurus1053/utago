package com.utago.wordbook;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WordbookRepository extends JpaRepository<Wordbook, Long> {

    /** 단어장 목록 화면 — 사용자의 모든 단어장 (즐겨찾기 기본 단어장 포함) */
    List<Wordbook> findByUserId(Long userId);

    List<Wordbook> findByUserIdAndFavoriteDefaultTrue(Long userId);

    /** 폴더 삭제 시, 그 폴더에 속했던 단어장들을 찾아 폴더 연결을 끊기 위함. */
    List<Wordbook> findByFolderId(Long folderId);

    /** 칭호 시스템 "단어장 다운로드" 카테고리 — 내 단어장들이 다른 사람에게 다운로드(복사)된
     *  총 횟수(TitleService 참고, 각 Wordbook.downloadCount의 합). */
    @Query("SELECT COALESCE(SUM(w.downloadCount), 0) FROM Wordbook w WHERE w.user.id = :userId")
    long sumDownloadCountByUserId(@Param("userId") Long userId);
}
