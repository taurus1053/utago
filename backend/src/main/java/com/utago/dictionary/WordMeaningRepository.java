package com.utago.dictionary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WordMeaningRepository extends JpaRepository<WordMeaning, Long> {

    /** 단어 팝업 — 빈도순(displayOrder)으로 다의어 뜻 목록 */
    List<WordMeaning> findByWordIdOrderByDisplayOrderAsc(Long wordId);

    /** 곡 학습 화면 — 소절 안 여러 단어의 뜻을 한 번에 불러올 때 */
    List<WordMeaning> findByWordIdInOrderByDisplayOrderAsc(List<Long> wordIds);
}
