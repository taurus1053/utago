package com.utago.friend;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

// claude/소셜_마이페이지_기획.md 4-1번 / 18번. requester가 addressee에게 보낸 친구 요청 1건.
// 수락되면 status=ACCEPTED로 갱신(양방향 관계는 FriendshipRepository의 OR 조회로 표현 —
// 별도 "친구" 테이블을 다시 만들지 않는다). 거절/취소는 행 자체를 지운다(FriendService 참고) —
// 재요청이 자유롭게 가능해야 하므로 DECLINED 상태로 남겨두지 않는다.
@Entity
@Table(name = "friendships")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Friendship {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "requester_id", nullable = false)
    private Long requesterId;

    @Column(name = "addressee_id", nullable = false)
    private Long addresseeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FriendshipStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;
}
