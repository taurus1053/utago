package com.utago.wordbook;

import com.utago.content.Song;
import com.utago.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** 사용자가 특정 곡을 어디까지 학습했는지 (이어 듣기/이어 학습용) */
@Entity
@Table(name = "user_song_progress")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSongProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_id", nullable = false)
    private Song song;

    @Column(name = "last_line_order", nullable = false)
    @Builder.Default
    private int lastLineOrder = 0;

    @Column(name = "last_studied_at")
    private LocalDateTime lastStudiedAt;
}
