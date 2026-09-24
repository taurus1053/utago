package com.utago.auth;

import com.utago.auth.dto.AuthResponse;
import com.utago.auth.dto.LoginRequest;
import com.utago.auth.dto.NicknameAvailabilityResponse;
import com.utago.auth.dto.RequestSignupCodeRequest;
import com.utago.auth.dto.SignupRequest;
import com.utago.auth.dto.SignupResponse;
import com.utago.auth.dto.VerifyEmailRequest;
import com.utago.auth.dto.VerifySignupCodeRequest;
import com.utago.auth.dto.ResendVerificationRequest;
import com.utago.user.User;
import com.utago.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int VERIFICATION_CODE_LENGTH = 6;
    private static final long VERIFICATION_CODE_VALID_MINUTES = 10;

    private final UserRepository userRepository;
    private final SignupVerificationRepository signupVerificationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;

    @Transactional(readOnly = true)
    public NicknameAvailabilityResponse checkNickname(String nickname) {
        boolean available = !userRepository.existsByNickname(nickname);
        return new NicknameAvailabilityResponse(nickname, available);
    }

    /** 회원가입 1단계: 이메일로 인증코드 발송. 계정은 아직 만들지 않는다. */
    @Transactional
    public void requestSignupCode(RequestSignupCodeRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalStateException("이미 가입된 이메일입니다.");
        }

        String code = generateVerificationCode();

        SignupVerification verification = signupVerificationRepository.findById(request.email())
                .orElseGet(() -> SignupVerification.builder().email(request.email()).build());
        verification.setCode(code);
        verification.setExpiresAt(LocalDateTime.now().plusMinutes(VERIFICATION_CODE_VALID_MINUTES));
        verification.setVerified(false);
        verification.setVerifiedAt(null);
        signupVerificationRepository.save(verification);

        // TODO: 실제 이메일 발송(SMTP) 연동 전까지는 로그로만 출력해서 개발 중 확인.
        System.out.printf("[SIGNUP EMAIL VERIFICATION] %s 에게 인증코드 %s 발송 (10분 유효)%n", request.email(), code);
    }

    /** 회원가입 1단계: 인증코드 확인. 통과하면 signup() 호출이 허용된다. */
    @Transactional
    public void verifySignupCode(VerifySignupCodeRequest request) {
        SignupVerification verification = signupVerificationRepository.findById(request.email())
                .orElseThrow(() -> new IllegalStateException("인증코드를 먼저 요청해주세요."));

        boolean codeMismatch = !verification.getCode().equals(request.code());
        boolean expired = verification.getExpiresAt().isBefore(LocalDateTime.now());

        if (codeMismatch || expired) {
            throw new IllegalStateException("인증 코드가 올바르지 않거나 만료되었습니다.");
        }

        verification.setVerified(true);
        verification.setVerifiedAt(LocalDateTime.now());
    }

    /** 회원가입 2단계: 이메일 인증이 끝난 뒤 나머지 정보로 계정을 생성한다. */
    @Transactional
    public SignupResponse signup(SignupRequest request) {
        SignupVerification verification = signupVerificationRepository.findById(request.email())
                .filter(SignupVerification::isVerified)
                .orElseThrow(() -> new IllegalStateException("이메일 인증을 먼저 완료해주세요."));

        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalStateException("이미 가입된 이메일입니다.");
        }
        if (userRepository.existsByNickname(request.nickname())) {
            throw new IllegalStateException("이미 사용 중인 닉네임입니다.");
        }

        User user = User.builder()
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .nickname(request.nickname())
                .nativeLang(request.nativeLang())
                .birthDate(request.birthDate())
                .authProvider("email")
                .emailVerified(true)
                .build();

        User saved = userRepository.save(user);
        signupVerificationRepository.delete(verification);

        return new SignupResponse(
                saved.getId(),
                saved.getEmail(),
                "가입이 완료됐어요! 이제 로그인해주세요."
        );
    }

    /** 구버전 흐름(가입 후 인증)에서 쓰이던 메서드. 새 흐름에서는 이미 인증된 상태로 가입되므로 보통 호출되지 않는다. */
    @Transactional
    public void verifyEmail(VerifyEmailRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalStateException("존재하지 않는 이메일입니다."));

        if (user.isEmailVerified()) {
            return;
        }

        boolean codeMissing = user.getVerificationCode() == null;
        boolean codeMismatch = !codeMissing && !user.getVerificationCode().equals(request.code());
        boolean expired = user.getVerificationCodeExpiresAt() == null
                || user.getVerificationCodeExpiresAt().isBefore(LocalDateTime.now());

        if (codeMissing || codeMismatch || expired) {
            throw new IllegalStateException("인증 코드가 올바르지 않거나 만료되었습니다.");
        }

        user.setEmailVerified(true);
        user.setVerificationCode(null);
        user.setVerificationCodeExpiresAt(null);
    }

    /** 구버전 흐름에서 쓰이던 메서드. 새 흐름에서는 이미 인증된 상태로 가입되므로 보통 호출되지 않는다. */
    @Transactional
    public void resendVerification(ResendVerificationRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalStateException("존재하지 않는 이메일입니다."));

        if (user.isEmailVerified()) {
            throw new IllegalStateException("이미 인증이 완료된 계정입니다.");
        }

        String code = generateVerificationCode();
        user.setVerificationCode(code);
        user.setVerificationCodeExpiresAt(LocalDateTime.now().plusMinutes(VERIFICATION_CODE_VALID_MINUTES));

        System.out.printf("[EMAIL VERIFICATION] %s 에게 인증코드 %s 재발송 (10분 유효)%n", user.getEmail(), code);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new IllegalStateException("이메일 또는 비밀번호가 올바르지 않습니다."));

        if (user.getPasswordHash() == null
                || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new IllegalStateException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        if (!user.isEmailVerified()) {
            throw new IllegalStateException("이메일 인증이 필요합니다.");
        }

        String token = jwtProvider.generateToken(user.getId(), user.getEmail());
        return new AuthResponse(token, user.getId(), user.getEmail(), user.getNickname());
    }

    private String generateVerificationCode() {
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < VERIFICATION_CODE_LENGTH; i++) {
            sb.append(random.nextInt(10));
        }
        return sb.toString();
    }
}
