package com.utago.wordbook;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserSongProgressRepository extends JpaRepository<UserSongProgress, Long> {

    /** "이어 학습" — 사용자가 이 곡을 어디까지 들었는지 (uk_progress_user_song) */
    Optional<UserSongProgress> findByUserIdAndSongId(Long userId, Long songId);
}
