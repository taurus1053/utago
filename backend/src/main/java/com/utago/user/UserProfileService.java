package com.utago.user;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;

/**
 * 마이페이지 프로필 — claude/소셜_마이페이지_기획.md 5-1. 칭호(title)는 아직 획득 조건이
 * 설계되지 않아(7번 열린 질문) 고정 문구를 내려준다. 학습 언어 국기도 지금은 일본어만
 * 지원해서 고정값이다.
 */
@Service
@RequiredArgsConstructor
public class UserProfileService {

    private static final String PLACEHOLDER_TITLE = "가사 탐험가";
    private static final String LEARNING_LANG_FLAG = "ja";

    /** AuthService와 같은 팔레트 — V24 이전에 만들어진 계정은 avatarColor가 비어있어서 여기서 배정. */
    private static final String[] AVATAR_PASTEL_COLORS = {
            "#C9E4DE", "#FAE1DD", "#DBCDF0", "#FDE2E4", "#CDE7F0", "#F0EFEB", "#FFF1D0"
    };
    private static final SecureRandom AVATAR_COLOR_RANDOM = new SecureRandom();

    private final UserRepository userRepository;

    /**
     * AdminTranslations/AdminSongs 등 어드민 화면이 호출하는 GET /api/users/me/role의 실제
     * 구현 — 프론트는 이미 이 엔드포인트를 호출하고 있었는데 백엔드에 대응하는 컨트롤러가
     * 없어서(이번에 발견) 지금까지 전부 404였다. UserController 신설하며 같이 채워넣음.
     */
    @Transactional(readOnly = true)
    public Role getRole(Long userId) {
        return requireUser(userId).getRole();
    }

    @Transactional
    public MyPageResponse getMyPage(Long userId) {
        User user = requireUser(userId);
        if (user.getAvatarColor() == null || user.getAvatarColor().isBlank()) {
            user.setAvatarColor(AVATAR_PASTEL_COLORS[AVATAR_COLOR_RANDOM.nextInt(AVATAR_PASTEL_COLORS.length)]);
        }
        return toResponse(user);
    }

    @Transactional
    public MyPageResponse updateStatusMessage(Long userId, String statusMessage) {
        User user = requireUser(userId);
        String trimmed = statusMessage == null ? null : statusMessage.trim();
        if (trimmed != null && trimmed.length() > 80) {
            throw new IllegalStateException("상태 메시지는 80자 이내로 입력해주세요.");
        }
        user.setStatusMessage(trimmed == null || trimmed.isBlank() ? null : trimmed);
        return toResponse(user);
    }

    private User requireUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
    }

    private MyPageResponse toResponse(User user) {
        String initial = user.getNickname() == null || user.getNickname().isBlank()
                ? "?"
                : user.getNickname().substring(0, 1);
        return new MyPageResponse(
                user.getNickname(),
                user.getAvatarColor(),
                initial,
                user.getStatusMessage(),
                PLACEHOLDER_TITLE,
                LEARNING_LANG_FLAG);
    }
}
