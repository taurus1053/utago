package com.utago.wordbook;

import com.utago.dictionary.Word;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 단어장에 담긴 단어 1개 + SRS(간격 반복) 상태.
 * "안다" -> interval 증가(1→3→7→14…), "모른다" -> interval 초기화 (SM-2 단순화 버전).
 */
@Entity
@Table(name = "wordbook_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WordbookItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "wordbook_id", nullable = false)
    private Wordbook wordbook;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "word_id", nullable = false)
    private Word word;

    @Column(nullable = false)
    @Builder.Default
    private boolean starred = false;

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
