package com.utago.content;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GrammarPointRepository extends JpaRepository<GrammarPoint, Long> {

    /** "문법 공부하기" 버튼 -> 해당 곡의 핵심 문법 목록 */
    List<GrammarPoint> findBySongId(Long songId);
}
