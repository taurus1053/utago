package com.utago.wordbook;

import com.utago.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** 단어장을 묶어 정리하는 폴더. 단어장은 폴더 없이도 존재할 수 있다(Wordbook.folder == null). */
@Entity
@Table(name = "wordbook_folders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WordbookFolder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 60)
    private String name;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
