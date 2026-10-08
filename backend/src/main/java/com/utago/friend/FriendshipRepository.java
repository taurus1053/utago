package com.utago.friend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FriendshipRepository extends JpaRepository<Friendship, Long> {

    /** 두 사용자 사이의 관계(어느 방향이든) — 검색 결과 배지(친구/요청 중/없음) 판정에 씀. */
    @Query("select f from Friendship f where " +
            "(f.requesterId = :userA and f.addresseeId = :userB) or " +
            "(f.requesterId = :userB and f.addresseeId = :userA)")
    Optional<Friendship> findBetween(@Param("userA") Long userA, @Param("userB") Long userB);

    /** 받은 요청 목록(마이페이지/친구 페이지) — PENDING만. */
    List<Friendship> findByAddresseeIdAndStatusOrderByCreatedAtDesc(Long addresseeId, FriendshipStatus status);

    /** 보낸 요청 목록(취소 버튼용) — PENDING만. */
    List<Friendship> findByRequesterIdAndStatusOrderByCreatedAtDesc(Long requesterId, FriendshipStatus status);

    /** 내 친구 목록 — 내가 requester였든 addressee였든 ACCEPTED인 모든 관계. */
    @Query("select f from Friendship f where f.status = com.utago.friend.FriendshipStatus.ACCEPTED " +
            "and (f.requesterId = :userId or f.addresseeId = :userId) order by f.respondedAt desc")
    List<Friendship> findAcceptedByUserId(@Param("userId") Long userId);
}
