package com.utago.dictionary;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WordMeaningRepository extends JpaRepository<WordMeaning, Long> {

    /** 단어 팝업 — 빈도순(displayOrder)으로 다의어 뜻 목록 */
    List<WordMeaning> findByWordIdOrderByDisplayOrderAsc(Long wordId);

    /** 곡 학습 화면 — 소절 안 여러 단어의 뜻을 한 번에 불러올 때 */
    List<WordMeaning> findByWordIdInOrderByDisplayOrderAsc(List<Long> wordIds);

    /** 단어 직접 추가/수정 — 사용자가 뜻을 고쳐 보내면 기존 뜻을 전부 지우고 새로 넣는다. */
    void deleteByWordId(Long wordId);
}
