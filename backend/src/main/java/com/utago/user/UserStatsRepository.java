package com.utago.user;

import org.springframework.data.jpa.repository.JpaRepository;

/** PK가 곧 user_id라 JpaRepository<UserStats, Long> 기본 findById(userId)로 바로 조회 가능 */
public interface UserStatsRepository extends JpaRepository<UserStats, Long> {
}
