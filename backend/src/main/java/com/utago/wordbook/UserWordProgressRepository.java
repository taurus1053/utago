package com.utago.wordbook;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserWordProgressRepository extends JpaRepository<UserWordProgress, Long> {

    Optional<UserWordProgress> findByUser_IdAndWord_Id(Long userId, Long wordId);

    /** 단어장 화면에서 여러 단어의 진행 상태를 한 번에 조회할 때 쓴다. */
    List<UserWordProgress> findByUser_IdAndWord_IdIn(Long userId, List<Long> wordIds);

    /** 마이페이지 "학습한 단어" 타일 — 한 번이라도 복습한(= 행이 생긴) 단어 수. */
    int countByUser_Id(Long userId);

    /** "완료한 곡" 판정 — 이 곡에 등장하는 단어 중 하나라도 실제로 복습(repetitionCount>0)한 적이 있는지. */
    boolean existsByUser_IdAndWord_IdInAndRepetitionCountGreaterThan(Long userId, List<Long> wordIds, int repetitionCount);

    /** 칭호 "같은 단어 복습"(TitleCategory.WORD_REPEAT) — 가장 많이 반복 학습한 단어 1개의
     * repetitionCount(최댓값). 복습 기록이 하나도 없으면 0. */
    @Query("SELECT COALESCE(MAX(p.repetitionCount), 0) FROM UserWordProgress p WHERE p.user.id = :userId")
    int findMaxRepetitionCountByUserId(@Param("userId") Long userId);
}
