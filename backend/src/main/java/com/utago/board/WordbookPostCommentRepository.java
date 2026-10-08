package com.utago.board;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WordbookPostCommentRepository extends JpaRepository<WordbookPostComment, Long> {

    List<WordbookPostComment> findByPostIdOrderByCreatedAtAsc(Long postId);

    long countByPostId(Long postId);

    /** 칭호 시스템 "댓글" 카테고리 — 내가 작성한 댓글 총수(TitleService 참고). */
    long countByAuthorId(Long authorId);

    /** 댓글 삭제 시 함께 지워지는 답글 수를 알아야 post.commentCount를 정확히 깎을 수
     * 있다(DB가 ON DELETE CASCADE로 지워주지만 캐시 카운터는 직접 맞춰야 함). */
    long countByParentId(Long parentId);
}
