package com.utago.wordbook;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface WordbookItemRepository extends JpaRepository<WordbookItem, Long> {

    /** 플래시카드 암기 화면 — 단어장 안의 전체 단어 */
    List<WordbookItem> findByWordbookId(Long wordbookId);

    /** 중복 추가 방지 (uk_items_wordbook_word) */
    Optional<WordbookItem> findByWordbookIdAndWordId(Long wordbookId, Long wordId);

    /** 홈 화면 "오늘 복습할 단어" — next_review_at이 지난 항목만 (SM-2 단순화 복습 큐) */
    List<WordbookItem> findByWordbookIdAndNextReviewAtLessThanEqual(Long wordbookId, LocalDateTime now);
}
