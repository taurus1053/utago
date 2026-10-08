package com.utago.grammar;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GrammarEntryRepository extends JpaRepository<GrammarEntry, Long> {

    /** /grammar?level=N5 목록 화면. */
    List<GrammarEntry> findByLevelOrderByIdAsc(GrammarLevel level);

    /** GrammarEntrySeedRunner — 이 레벨이 이미 채워졌는지 확인(0건이면 아직 안 채움). */
    long countByLevel(GrammarLevel level);

    /**
     * GrammarPointService가 곡 문법 포인트를 생성할 때 같은 패턴이 이미 있는지 확인하는
     * 중복 방지 조회 — 대소문자/공백 차이를 무시하기 위해 양쪽 다 TRIM/LOWER 비교.
     */
    @Query("SELECT e FROM GrammarEntry e WHERE e.lang = :lang AND LOWER(TRIM(e.pattern)) = LOWER(TRIM(:pattern))")
    Optional<GrammarEntry> findByLangAndNormalizedPattern(@Param("lang") com.utago.common.Lang lang, @Param("pattern") String pattern);
}
