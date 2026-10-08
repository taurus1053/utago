package com.utago.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GrammarPointRepository extends JpaRepository<GrammarPoint, Long> {

    /** "문법 공부하기" 버튼 -> 해당 곡의 핵심 문법 목록 */
    List<GrammarPoint> findBySongId(Long songId);

    /** 문법 사전(GrammarEntry) 상세 화면 — "이 문법이 쓰인 노래" 역추적(GrammarService 참고). */
    List<GrammarPoint> findByGrammarEntry_Id(Long grammarEntryId);
}
