package com.utago.wordbook;

import com.utago.content.Visibility;
import com.utago.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "wordbooks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Wordbook {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** 이 단어장이 속한 폴더. 폴더 없이(null) 존재할 수도 있다. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id")
    private WordbookFolder folder;

    @Column(nullable = false, length = 60)
    private String name;

    /** 즐겨찾기 단어장은 계정 생성 시 기본 제공, 별도 생성 불가 */
    @Column(name = "is_favorite_default", nullable = false)
    @Builder.Default
    private boolean favoriteDefault = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /** 공개 범위 — 기본 비공개. 게시판에 공유하려면 PUBLIC으로 바꿔야 한다(V20). */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private Visibility visibility = Visibility.PRIVATE;

    /** 운영진이 올린 공식 단어장(JLPT 프리셋 등) 배지. */
    @Column(name = "is_official", nullable = false)
    @Builder.Default
    private boolean official = false;

    /** 몇 번 "내 단어장에 추가"(스냅샷 복사)됐는지. */
    @Column(name = "download_count", nullable = false)
    @Builder.Default
    private int downloadCount = 0;

    /** 단어장 카드 아이콘 — 생성 시 선택, 이후에도 수정 가능. 기본값 책 이모티콘. */
    @Column(nullable = false, length = 8)
    @Builder.Default
    private String emoji = "📘";
}
