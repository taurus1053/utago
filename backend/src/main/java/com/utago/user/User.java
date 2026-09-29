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
}
