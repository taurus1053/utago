package com.utago.user;

import com.utago.common.Lang;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    /** 이메일 가입 시에만 사용. 소셜 로그인(구글/애플) 계정은 NULL. */
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 60)
    private String nickname;

    /** 프로필 아바타 기본 배경색(랜덤 파스텔, hex) — 회원가입 시 배정(AuthService 참고),
     * 추후 실제 사진으로 교체 가능(V24, 소셜_마이페이지_기획.md 9-3). */
    @Column(name = "avatar_color", length = 10)
    private String avatarColor;

    /** 마이페이지 프로필의 한 줄 소개(V24, 9-2). */
    @Column(name = "status_message", length = 80)
    private String statusMessage;

    /** 현재 착용 중인 칭호 코드(TitleCatalog 참고, V27) — null이면 아직 아무것도 착용 안 함
     * (프로필엔 TitleService가 기본값을 골라 보여준다). */
    @Column(name = "equipped_title_code", length = 60)
    private String equippedTitleCode;

    /** 누적 학습시간 칭호(1/5/10/30/50/100시간)를 위한 총 학습 시간(초) 누적값(V27) —
     * 학습 화면의 하트비트(POST /api/users/me/study-ping)로 조금씩 늘어난다. */
    @Column(name = "total_study_seconds", nullable = false)
    @Builder.Default
    private long totalStudySeconds = 0L;

    /** 칭호 "내가 다운로드한 개수"(DOWNLOAD_RECEIVED) 원천 데이터(V29) — 내가 다른 사람의
     * 단어장을 다운로드(복사)할 때마다(WordbookService.downloadWordbook) 1씩 늘어난다. */
    @Column(name = "downloads_received_count", nullable = false)
    @Builder.Default
    private long downloadsReceivedCount = 0L;

    /** 칭호 "학습 방법별"(STUDY_METHOD) 원천 데이터(V29) — 단어장 학습 게임(플래시카드/퀴즈/
     * 빈칸채우기/문장배열/카드맞추기)에서 정답을 맞출 때마다 해당 방법의 카운트가 1씩 늘어난다
     * (WordbookService.review, ReviewWordbookItemRequest.method). */
    @Column(name = "study_flashcard_count", nullable = false)
    @Builder.Default
    private long studyFlashcardCount = 0L;
    @Column(name = "study_quiz_count", nullable = false)
    @Builder.Default
    private long studyQuizCount = 0L;
    @Column(name = "study_fill_count", nullable = false)
    @Builder.Default
    private long studyFillCount = 0L;
    @Column(name = "study_reorder_count", nullable = false)
    @Builder.Default
    private long studyReorderCount = 0L;
    @Column(name = "study_match_count", nullable = false)
    @Builder.Default
    private long studyMatchCount = 0L;

    /** 칭호 "학습 시간대"(TIME_OF_DAY) 원천 데이터(V29) — 단어 복습/가사 진행이 일어난 시각
     * (LocalTime.now())에 따라 네 버킷 중 하나가 1씩 늘어난다(LearningStatsService 참고). */
    @Column(name = "study_dawn_count", nullable = false)
    @Builder.Default
    private long studyDawnCount = 0L;
    @Column(name = "study_morning_count", nullable = false)
    @Builder.Default
    private long studyMorningCount = 0L;
    @Column(name = "study_afternoon_count", nullable = false)
    @Builder.Default
    private long studyAfternoonCount = 0L;
    @Column(name = "study_night_count", nullable = false)
    @Builder.Default
    private long studyNightCount = 0L;

    @Enumerated(EnumType.STRING)
    @Column(name = "native_lang", nullable = false, length = 10)
    private Lang nativeLang;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(name = "auth_provider", nullable = false, length = 30)
    private String authProvider;

    /** 일반 사용자(USER) / 운영진(ADMIN) — 번역 캐시 관리자 페이지 등 접근 제어에 쓰임. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Role role = Role.USER;

    @Column(name = "email_verified", nullable = false)
    @Builder.Default
    private boolean emailVerified = false;

    @Column(name = "verification_code", length = 10)
    private String verificationCode;

    @Column(name = "verification_code_expires_at")
    private LocalDateTime verificationCodeExpiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /** 게시판 신고 처리(claude/소셜_마이페이지_기획.md 23번, V34)로 누적되는 경고 횟수 —
     * 자동 정지 같은 추가 정책은 아직 없고, 운영진이 신고 관리 화면에서 직접 보고 판단한다. */
    @Column(name = "warning_count", nullable = false)
    @Builder.Default
    private int warningCount = 0;

    /** 게시판 신고 처리로 계정이 정지된 경우 그 해제 시각(V34) — null이거나 과거면 정지
     * 아님. 현재보다 미래면 로그인 자체가 막힌다(AuthService.login() 참고). */
    @Column(name = "suspended_until")
    private LocalDateTime suspendedUntil;
}
