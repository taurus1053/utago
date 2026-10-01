package com.utago.board;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WordbookPostCommentRepository extends JpaRepository<WordbookPostComment, Long> {

    List<WordbookPostComment> findByPostIdOrderByCreatedAtAsc(Long postId);

    long countByPostId(Long postId);
}
