package com.utago.wordbook;

import com.utago.content.Song;
import com.utago.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** 사용자가 특정 곡을 어디까지 학습했는지 (이어 듣기/이어 학습용) */
@Entity
@Table(name = "user_song_progress")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSongProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "song_id", nullable = false)
    private Song song;

    @Column(name = "last_line_order", nullable = false)
    @Builder.Default
    private int lastLineOrder = 0;

    @Column(name = "last_studied_at")
    private LocalDateTime lastStudiedAt;

    /** 칭호 "같은 곡 복습"(TitleCategory.SONG_REPEAT) — 이 곡을 처음부터 끝까지 완주한
     * 횟수(2026-10-08 사용자 확정: "끝까지 다시 완주할 때마다" +1). SongService#updateSongProgress
     * 참고 — lastLineOrder(이어 학습용, 항상 최댓값만 저장)와는 별개 지표다. */
    @Column(name = "completed_count", nullable = false)
    @Builder.Default
    private int completedCount = 0;

    /** 한 번의 "완주"를 중복 집계하지 않기 위한 내부 플래그 — 마지막 줄 근처에서 진행 상황
     * 업데이트가 여러 번 호출돼도 완주 1회로만 센다. 다시 처음(0번 줄)으로 돌아가면 풀려서
     * 다음 완주를 또 셀 수 있게 된다. */
    @Column(name = "completed_this_pass", nullable = false)
    @Builder.Default
    private boolean completedThisPass = false;
}
