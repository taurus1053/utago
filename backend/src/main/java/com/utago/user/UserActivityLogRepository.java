package com.utago.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface UserActivityLogRepository extends JpaRepository<UserActivityLog, Long> {

    Optional<UserActivityLog> findByUserIdAndActivityDate(Long userId, LocalDate activityDate);

    /** 스트릭 계산/캘린더용 — 최신순으로 전부(보통 몇십~몇백 건 수준이라 페이징 없이 전체 조회). */
    List<UserActivityLog> findByUserIdOrderByActivityDateDesc(Long userId);
}
