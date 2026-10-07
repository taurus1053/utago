package com.utago.wordbook;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserSongProgressRepository extends JpaRepository<UserSongProgress, Long> {

    /** "이어 학습" — 사용자가 이 곡을 어디까지 들었는지 (uk_progress_user_song) */
    Optional<UserSongProgress> findByUserIdAndSongId(Long userId, Long songId);

    /** 마이페이지 "완료한 가사"/"완료한 곡" 타일 집계용 — 사용자가 진행 기록을 남긴 모든 곡. */
    List<UserSongProgress> findByUserId(Long userId);

    /** 칭호 "같은 곡 복습"(TitleCategory.SONG_REPEAT) — 가장 많이 반복 완주한 곡 1개의
     * completedCount(최댓값). 완주 기록이 하나도 없으면 0. */
    @Query("SELECT COALESCE(MAX(p.completedCount), 0) FROM UserSongProgress p WHERE p.user.id = :userId")
    int findMaxCompletedCountByUserId(@Param("userId") Long userId);
}
