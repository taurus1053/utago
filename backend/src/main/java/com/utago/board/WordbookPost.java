package com.utago.board;

import com.utago.user.User;
import com.utago.wordbook.Wordbook;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * "단어장 둘러보기" 게시판의 글 하나 — 단어장(Wordbook) 하나에 제목/본문을 붙여 공개한다.
 * 글을 올리는 순간 첨부된 Wordbook의 visibility를 PUBLIC으로 바꾼다(WordbookPostService 참고).
 * 운영진이 올린 공식 글(JLPT 프리셋 등)은 isOfficial=true로 목록 상단에 고정 노출된다.
 */
@Entity
@Table(name = "wordbook_posts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WordbookPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "wordbook_id", nullable = false)
    private Wordbook wordbook;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_user_id", nullable = false)
    private User author;

    @Column(nullable = false, length = 100)
    private String title;

    @Lob
    @Column(nullable = false)
    private String body;

    @Column(name = "is_official", nullable = false)
    @Builder.Default
    private boolean official = false;

    /** 좋아요/댓글 수 캐시 — 실제 WordbookPostLike/Comment 테이블과 동기화(WordbookPostService 참고). */
    @Column(name = "like_count", nullable = false)
    @Builder.Default
    private int likeCount = 0;

    @Column(name = "comment_count", nullable = false)
    @Builder.Default
    private int commentCount = 0;

    /** 저장(북마크) 수 캐시 — 실제 WordbookPostSave 테이블과 동기화(WordbookPostService 참고, V23). */
    @Column(name = "save_count", nullable = false)
    @Builder.Default
    private int saveCount = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}
