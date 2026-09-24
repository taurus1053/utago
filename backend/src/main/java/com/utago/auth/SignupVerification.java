package com.utago.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 회원가입 전, 이메일만 먼저 인증하기 위한 임시 레코드.
 * 계정(User)이 아직 없는 상태에서 이메일 소유를 확인하는 용도라 users 테이블과는 분리한다.
 * signup() 이 성공하면 이 레코드는 삭제된다.
 */
@Entity
@Table(name = "signup_email_verification")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SignupVerification {

    @Id
    @Column(nullable = false, length = 255)
    private String email;

    @Column(nullable = false, length = 10)
    private String code;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    @Builder.Default
    private boolean verified = false;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;
}
