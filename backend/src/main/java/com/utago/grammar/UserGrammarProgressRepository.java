package com.utago.grammar;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserGrammarProgressRepository extends JpaRepository<UserGrammarProgress, Long> {

    Optional<UserGrammarProgress> findByUser_IdAndGrammarEntry_Id(Long userId, Long grammarEntryId);

    /** /grammar?level=N5 목록에서 로그인 사용자의 learned 상태를 한 번에 머지할 때 쓴다. */
    List<UserGrammarProgress> findByUser_IdAndGrammarEntry_IdIn(Long userId, List<Long> grammarEntryIds);

    /** 마이페이지 "학습한 문법" 통계(향후 확장용) — 학습 완료로 체크한 문법 개수. */
    long countByUser_IdAndLearnedTrue(Long userId);
}
