package com.utago.board;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WordbookPostLikeRepository extends JpaRepository<WordbookPostLike, Long> {

    Optional<WordbookPostLike> findByPostIdAndUserId(Long postId, Long userId);

    boolean existsByPostIdAndUserId(Long postId, Long userId);

    /** 상세/목록 화면에서 "지금 로그인한 사용자가 좋아요 누른 게시글" 목록을 한 번에 조회할 때. */
    List<WordbookPostLike> findByUserIdAndPostIdIn(Long userId, List<Long> postIds);

    long countByPostId(Long postId);

    /** 칭호 시스템 "좋아요" 카테고리 — 내가 누른 좋아요 총수(TitleService 참고). */
    long countByUserId(Long userId);
}
