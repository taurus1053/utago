package com.utago.wordbook;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WordbookRepository extends JpaRepository<Wordbook, Long> {

    /** 단어장 목록 화면 — 사용자의 모든 단어장 (즐겨찾기 기본 단어장 포함) */
    List<Wordbook> findByUserId(Long userId);

    List<Wordbook> findByUserIdAndFavoriteDefaultTrue(Long userId);

    /** 폴더 삭제 시, 그 폴더에 속했던 단어장들을 찾아 폴더 연결을 끊기 위함. */
    List<Wordbook> findByFolderId(Long folderId);
}
