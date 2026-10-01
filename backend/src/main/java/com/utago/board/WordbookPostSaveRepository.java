package com.utago.board;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WordbookPostSaveRepository extends JpaRepository<WordbookPostSave, Long> {

    Optional<WordbookPostSave> findByPostIdAndUserId(Long postId, Long userId);

    boolean existsByPostIdAndUserId(Long postId, Long userId);

    /** 상세/목록 화면에서 "지금 로그인한 사용자가 저장한 게시글" 목록을 한 번에 조회할 때. */
    List<WordbookPostSave> findByUserIdAndPostIdIn(Long userId, List<Long> postIds);
}
