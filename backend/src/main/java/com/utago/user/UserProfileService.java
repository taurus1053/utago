package com.utago.user;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;

/**
 * 마이페이지 프로필 — claude/소셜_마이페이지_기획.md 5-1. 칭호(title)는 2026-10-07부터
 * TitleService가 실제 통계 기준으로 계산한 "현재 착용 칭호" 이름을 내려준다(15-6번).
 * 학습 언어 국기는 지금은 일본어만 지원해서 고정값이다.
 */
@Service
@RequiredArgsConstructor
public class UserProfileService {

    /** 학습 화면 하트비트 한 번에 더할 수 있는 최대 초(악의적/비정상 호출로 과도하게
     *  쌓이는 것을 막는 방어적 상한 — 프론트는 보통 30초 간격으로 보낸다). */
    private static final int MAX_STUDY_PING_SECONDS = 60;

    private static final String LEARNING_LANG_FLAG = "ja";

    /** AuthService와 같은 팔레트 — V24 이전에 만들어진 계정은 avatarColor가 비어있어서 여기서 배정. */
    private static final String[] AVATAR_PASTEL_COLORS = {
            "#C9E4DE", "#FAE1DD", "#DBCDF0", "#FDE2E4", "#CDE7F0", "#F0EFEB", "#FFF1D0"
    };
    private static final SecureRandom AVATAR_COLOR_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final TitleService titleService;

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

    /** 학습 화면 하트비트(POST /api/users/me/study-ping) — 누적 학습시간 칭호의 원천 데이터. */
    @Transactional
    public StudyPingResponse addStudySeconds(Long userId, int seconds) {
        User user = requireUser(userId);
        int clamped = Math.max(0, Math.min(seconds, MAX_STUDY_PING_SECONDS));
        user.setTotalStudySeconds(user.getTotalStudySeconds() + clamped);
        return new StudyPingResponse(user.getTotalStudySeconds(), user.getTotalStudySeconds() / 3600.0);
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
                titleService.getEquippedTitleName(user.getId()),
                LEARNING_LANG_FLAG,
                user.getNativeLang());
    }
}
