package com.utago.wordbook;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WordbookRepository extends JpaRepository<Wordbook, Long> {

    /** 단어장 목록 화면 — 사용자의 모든 단어장 (즐겨찾기 기본 단어장 포함) */
    List<Wordbook> findByUserId(Long userId);

    List<Wordbook> findByUserIdAndFavoriteDefaultTrue(Long userId);
}
