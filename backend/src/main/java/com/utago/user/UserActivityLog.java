package com.utago.user;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

/**
 * 사용자가 "학습 행위"(단어 복습, 가사 진행)를 한 날짜 — 하루에 한 행만 존재한다
 * (uk_activity_user_date). 연속 학습일(스트릭) 계산과 마이페이지 스트릭 캘린더가
 * 이 테이블을 기준으로 한다. {@link LearningStatsService} 참고.
 */
@Entity
@Table(name = "user_activity_log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "activity_date", nullable = false)
    private LocalDate activityDate;
}
