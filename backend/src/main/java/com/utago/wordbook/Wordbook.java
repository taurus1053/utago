package com.utago.wordbook;

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

    @Column(nullable = false, length = 60)
    private String name;

    /** 즐겨찾기 단어장은 계정 생성 시 기본 제공, 별도 생성 불가 */
    @Column(name = "is_favorite_default", nullable = false)
    @Builder.Default
    private boolean favoriteDefault = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
