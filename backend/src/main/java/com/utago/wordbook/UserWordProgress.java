package com.utago.wordbook;

import com.utago.dictionary.Word;
import com.utago.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 사용자 1명 + 단어 1개에 대한 SRS(간격 반복) 학습 진행 상태. "안다" -> interval 증가
 * (1→3→7→14…), "모른다" -> interval 초기화 (SM-2 단순화 버전).
 *
 * 예전엔 이 상태를 WordbookItem(단어장 항목)마다 따로 가지고 있어서, 같은 단어가 여러
 * 단어장(예: 즐겨찾기 + 커스텀 단어장)에 동시에 담겨 있으면 한쪽에서 복습해도 다른 쪽에는
 * 반영되지 않는 문제가 있었다. 이제는 사용자+단어 단위로 딱 하나만 존재해서, 그 단어가
 * 어느 단어장에 담겨 있든 학습 횟수/복습 주기가 항상 동일하게 보인다(uk_user_word_progress).
 */
@Entity
@Table(name = "user_word_progress")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserWordProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "word_id", nullable = false)
    private Word word;

    @Column(name = "next_review_at")
    private LocalDateTime nextReviewAt;

    @Column(name = "interval_days", nullable = false)
    @Builder.Default
    private int intervalDays = 1;

    @Column(name = "repetition_count", nullable = false)
    @Builder.Default
    private int repetitionCount = 0;

    @Column(name = "ease_factor", nullable = false, precision = 4, scale = 2)
    @Builder.Default
    private BigDecimal easeFactor = new BigDecimal("2.50");

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private WordbookItemStatus status = WordbookItemStatus.LEARNING;
}
