package com.utago.user;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * users 테이블과 1:1. 스트릭/누적 학습 단어 수 등 게이미피케이션·통계용.
 */
@Entity
@Table(name = "user_stats")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserStats {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "total_words_learned", nullable = false)
    @Builder.Default
    private int totalWordsLearned = 0;

    @Column(name = "current_streak_days", nullable = false)
    @Builder.Default
    private int currentStreakDays = 0;

    @Column(name = "longest_streak_days", nullable = false)
    @Builder.Default
    private int longestStreakDays = 0;

    @Column(name = "last_active_at")
    private LocalDateTime lastActiveAt;
}
