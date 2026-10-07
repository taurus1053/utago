package com.utago.board;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WordbookPostCommentRepository extends JpaRepository<WordbookPostComment, Long> {

    List<WordbookPostComment> findByPostIdOrderByCreatedAtAsc(Long postId);

    long countByPostId(Long postId);

    /** 칭호 시스템 "댓글" 카테고리 — 내가 작성한 댓글 총수(TitleService 참고). */
    long countByAuthorId(Long authorId);
}
