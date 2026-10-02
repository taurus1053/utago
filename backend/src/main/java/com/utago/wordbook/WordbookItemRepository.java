package com.utago.wordbook;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface WordbookItemRepository extends JpaRepository<WordbookItem, Long> {

    /** 플래시카드 암기 화면 — 단어장 안의 전체 단어 */
    List<WordbookItem> findByWordbookId(Long wordbookId);

    /** 중복 추가 방지 (uk_items_wordbook_word) */
    Optional<WordbookItem> findByWordbookIdAndWordId(Long wordbookId, Long wordId);

    // 홈 화면 "오늘 복습할 단어"(next_review_at이 지난 것만) 큐는, SRS 진행 상태가
    // UserWordProgress로 옮겨가면서 이제 UserWordProgressRepository에서 조회해야 한다 —
    // 아직 구현 전(홈 화면이 이 기능 자체를 목업으로 유지 중)이라 여기 있던 메서드는 제거.

    /** 곡 학습 화면에서 "이 단어, 내 단어장 중 어디어디에 이미 있지?" 배치 조회용. */
    List<WordbookItem> findByWordbook_User_IdAndWordIdIn(Long userId, List<Long> wordIds);

    /** 마이페이지 학습 통계 — "완료한 곡" 판정에, 이 곡 단어 중 하나라도 단어장에 담은 적 있는지. */
    boolean existsByWordbook_User_IdAndWordIdIn(Long userId, List<Long> wordIds);

    /** 홈 화면 "단어 복습하기" — 단어장에 있고 없고 상관없이(모든 단어장 통틀어) 무작위 한 개. */
    @Query(value = "SELECT wi.* FROM wordbook_items wi JOIN wordbooks wb ON wi.wordbook_id = wb.id " +
            "WHERE wb.user_id = :userId ORDER BY RAND() LIMIT 1", nativeQuery = true)
    Optional<WordbookItem> findRandomByUserId(@Param("userId") Long userId);
}
