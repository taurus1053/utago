package com.utago.dictionary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WordMeaningRepository extends JpaRepository<WordMeaning, Long> {

    /** 단어 팝업 — 빈도순(displayOrder)으로 다의어 뜻 목록 */
    List<WordMeaning> findByWordIdOrderByDisplayOrderAsc(Long wordId);
}
