package com.utago.friend;

import com.utago.notification.NotificationService;
import com.utago.user.User;
import com.utago.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/** 친구 기능(Phase 3) — claude/소셜_마이페이지_기획.md 4번(설계) → 18번(실제 구현).
 * 닉네임 검색 → 요청 보내기 → 상대가 수락/거절 → 수락되면 양쪽 다 "친구"로 조회되는 흐름.
 * 거절/취소는 행을 삭제한다 — DECLINED 상태로 남겨두면 "한 번 거절하면 영영 재요청 불가"가
 * 되는데, 그걸 원하는지 기획에서 정한 적이 없어서 더 단순하고 되돌리기 쉬운 쪽(삭제)을 택했다. */
@Service
@RequiredArgsConstructor
public class FriendService {

    private static final int SEARCH_LIMIT = 20;

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public List<FriendSearchResponse> search(Long myUserId, String nickname) {
        if (nickname == null || nickname.isBlank()) return List.of();
        List<User> matches = userRepository.findByNicknameContainingIgnoreCaseAndIdNot(
                nickname.trim(), myUserId, PageRequest.of(0, SEARCH_LIMIT));
        return matches.stream()
                .map(u -> new FriendSearchResponse(
                        u.getId(), u.getNickname(), u.getAvatarColor(), avatarInitial(u),
                        relationWith(myUserId, u.getId())))
                .toList();
    }

    private FriendRelationStatus relationWith(Long myUserId, Long otherUserId) {
        Optional<Friendship> existing = friendshipRepository.findBetween(myUserId, otherUserId);
        if (existing.isEmpty()) return FriendRelationStatus.NONE;
        Friendship f = existing.get();
        if (f.getStatus() == FriendshipStatus.ACCEPTED) return FriendRelationStatus.FRIENDS;
        if (f.getStatus() == FriendshipStatus.PENDING) {
            return f.getRequesterId().equals(myUserId)
                    ? FriendRelationStatus.PENDING_OUTGOING
                    : FriendRelationStatus.PENDING_INCOMING;
        }
        return FriendRelationStatus.NONE; // DECLINED/BLOCKED 행은 지워서 조회에 안 걸리지만, 방어적으로.
    }

    @Transactional
    public void sendRequest(Long myUserId, Long addresseeUserId) {
        if (myUserId.equals(addresseeUserId)) {
            throw new IllegalStateException("자기 자신에게는 친구 요청을 보낼 수 없습니다.");
        }
        userRepository.findById(addresseeUserId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
        Optional<Friendship> existing = friendshipRepository.findBetween(myUserId, addresseeUserId);
        if (existing.isPresent()) {
            throw new IllegalStateException("이미 친구 관계이거나 요청이 진행 중입니다.");
        }
        friendshipRepository.save(Friendship.builder()
                .requesterId(myUserId)
                .addresseeId(addresseeUserId)
                .status(FriendshipStatus.PENDING)
                .build());
        notificationService.notifyFriendRequest(myUserId, addresseeUserId);
    }

    @Transactional(readOnly = true)
    public List<FriendRequestResponse> listIncoming(Long myUserId) {
        return friendshipRepository.findByAddresseeIdAndStatusOrderByCreatedAtDesc(myUserId, FriendshipStatus.PENDING)
                .stream()
                .map(f -> toRequestResponse(f, f.getRequesterId()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FriendRequestResponse> listOutgoing(Long myUserId) {
        return friendshipRepository.findByRequesterIdAndStatusOrderByCreatedAtDesc(myUserId, FriendshipStatus.PENDING)
                .stream()
                .map(f -> toRequestResponse(f, f.getAddresseeId()))
                .toList();
    }

    private FriendRequestResponse toRequestResponse(Friendship f, Long otherUserId) {
        User other = userRepository.findById(otherUserId).orElse(null);
        if (other == null) {
            return new FriendRequestResponse(f.getId(), otherUserId, "(탈퇴한 사용자)", null, "?", f.getCreatedAt());
        }
        return new FriendRequestResponse(
                f.getId(), other.getId(), other.getNickname(), other.getAvatarColor(), avatarInitial(other),
                f.getCreatedAt());
    }

    /** 받은 요청 수락 — addressee 본인만 가능. */
    @Transactional
    public void accept(Long myUserId, Long requestId) {
        Friendship f = requireRequest(requestId);
        if (!f.getAddresseeId().equals(myUserId)) {
            throw new IllegalStateException("본인에게 온 요청만 수락할 수 있습니다.");
        }
        if (f.getStatus() != FriendshipStatus.PENDING) {
            throw new IllegalStateException("이미 처리된 요청입니다.");
        }
        f.setStatus(FriendshipStatus.ACCEPTED);
        f.setRespondedAt(java.time.LocalDateTime.now());
        notificationService.notifyFriendAccepted(myUserId, f.getRequesterId());
    }

    /** 받은 요청 거절 — addressee 본인만. 재요청이 자유롭도록 행 자체를 삭제한다. */
    @Transactional
    public void decline(Long myUserId, Long requestId) {
        Friendship f = requireRequest(requestId);
        if (!f.getAddresseeId().equals(myUserId)) {
            throw new IllegalStateException("본인에게 온 요청만 거절할 수 있습니다.");
        }
        friendshipRepository.delete(f);
    }

    /** 보낸 요청 취소 — requester 본인만. */
    @Transactional
    public void cancel(Long myUserId, Long requestId) {
        Friendship f = requireRequest(requestId);
        if (!f.getRequesterId().equals(myUserId)) {
            throw new IllegalStateException("본인이 보낸 요청만 취소할 수 있습니다.");
        }
        friendshipRepository.delete(f);
    }

    private Friendship requireRequest(Long requestId) {
        return friendshipRepository.findById(requestId)
                .orElseThrow(() -> new IllegalStateException("요청을 찾을 수 없습니다."));
    }

    @Transactional(readOnly = true)
    public List<FriendResponse> listFriends(Long myUserId) {
        return friendshipRepository.findAcceptedByUserId(myUserId).stream()
                .map(f -> {
                    Long otherUserId = f.getRequesterId().equals(myUserId) ? f.getAddresseeId() : f.getRequesterId();
                    return userRepository.findById(otherUserId).orElse(null);
                })
                .filter(java.util.Objects::nonNull)
                .map(u -> new FriendResponse(u.getId(), u.getNickname(), u.getAvatarColor(), avatarInitial(u), u.getStatusMessage()))
                .toList();
    }

    /** 친구 삭제(단방향 관계 자체가 없으므로 둘 중 누가 끊어도 똑같이 처리) — 마이페이지/친구
     * 페이지 양쪽에서 쓴다. */
    @Transactional
    public void removeFriend(Long myUserId, Long friendUserId) {
        Friendship f = friendshipRepository.findBetween(myUserId, friendUserId)
                .filter(x -> x.getStatus() == FriendshipStatus.ACCEPTED)
                .orElseThrow(() -> new IllegalStateException("친구 관계가 아닙니다."));
        friendshipRepository.delete(f);
    }

    private String avatarInitial(User user) {
        String nickname = user.getNickname();
        return nickname == null || nickname.isBlank() ? "?" : nickname.substring(0, 1);
    }
}
