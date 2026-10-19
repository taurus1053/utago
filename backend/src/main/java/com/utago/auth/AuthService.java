package com.utago.auth;

import com.utago.common.ApiException;
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

    /** 프로필 아바타 기본 배경색 후보(파스텔 톤) — 소셜_마이페이지_기획.md 9-3. */
    private static final String[] AVATAR_PASTEL_COLORS = {
            "#C9E4DE", "#FAE1DD", "#DBCDF0", "#FDE2E4", "#CDE7F0", "#F0EFEB", "#FFF1D0"
    };
    private static final SecureRandom AVATAR_COLOR_RANDOM = new SecureRandom();

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
            throw new ApiException("auth.emailTaken", "이미 가입된 이메일입니다.");
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
                .orElseThrow(() -> new ApiException("auth.codeNotRequested", "인증코드를 먼저 요청해주세요."));

        boolean codeMismatch = !verification.getCode().equals(request.code());
        boolean expired = verification.getExpiresAt().isBefore(LocalDateTime.now());

        if (codeMismatch || expired) {
            throw new ApiException("auth.codeInvalid", "인증 코드가 올바르지 않거나 만료되었습니다.");
        }

        verification.setVerified(true);
        verification.setVerifiedAt(LocalDateTime.now());
    }

    /** 회원가입 2단계: 이메일 인증이 끝난 뒤 나머지 정보로 계정을 생성한다. */
    @Transactional
    public SignupResponse signup(SignupRequest request) {
        SignupVerification verification = signupVerificationRepository.findById(request.email())
                .filter(SignupVerification::isVerified)
                .orElseThrow(() -> new ApiException("auth.emailNotVerified", "이메일 인증을 먼저 완료해주세요."));

        if (userRepository.existsByEmail(request.email())) {
            throw new ApiException("auth.emailTaken", "이미 가입된 이메일입니다.");
        }
        if (userRepository.existsByNickname(request.nickname())) {
            throw new ApiException("auth.nicknameTaken", "이미 사용 중인 닉네임입니다.");
        }

        User user = User.builder()
                .email(request.email())
                .passwordHash(passwordEncoder.encode(request.password()))
                .nickname(request.nickname())
                .avatarColor(randomAvatarColor())
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
                .orElseThrow(() -> new ApiException("auth.emailNotFound", "존재하지 않는 이메일입니다."));

        if (user.isEmailVerified()) {
            return;
        }

        boolean codeMissing = user.getVerificationCode() == null;
        boolean codeMismatch = !codeMissing && !user.getVerificationCode().equals(request.code());
        boolean expired = user.getVerificationCodeExpiresAt() == null
                || user.getVerificationCodeExpiresAt().isBefore(LocalDateTime.now());

        if (codeMissing || codeMismatch || expired) {
            throw new ApiException("auth.codeInvalid", "인증 코드가 올바르지 않거나 만료되었습니다.");
        }

        user.setEmailVerified(true);
        user.setVerificationCode(null);
        user.setVerificationCodeExpiresAt(null);
    }

    /** 구버전 흐름에서 쓰이던 메서드. 새 흐름에서는 이미 인증된 상태로 가입되므로 보통 호출되지 않는다. */
    @Transactional
    public void resendVerification(ResendVerificationRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new ApiException("auth.emailNotFound", "존재하지 않는 이메일입니다."));

        if (user.isEmailVerified()) {
            throw new ApiException("auth.alreadyVerified", "이미 인증이 완료된 계정입니다.");
        }

        String code = generateVerificationCode();
        user.setVerificationCode(code);
        user.setVerificationCodeExpiresAt(LocalDateTime.now().plusMinutes(VERIFICATION_CODE_VALID_MINUTES));

        System.out.printf("[EMAIL VERIFICATION] %s 에게 인증코드 %s 재발송 (10분 유효)%n", user.getEmail(), code);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new ApiException("auth.badCredentials", "이메일 또는 비밀번호가 올바르지 않습니다."));

        if (user.getPasswordHash() == null
                || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ApiException("auth.badCredentials", "이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        if (!user.isEmailVerified()) {
            throw new ApiException("auth.verificationRequired", "이메일 인증이 필요합니다.");
        }

        // 게시판 신고 처리(claude/소셜_마이페이지_기획.md 23번)로 정지된 계정은 해제 시각이
        // 지나기 전까지 로그인 자체를 막는다.
        if (user.getSuspendedUntil() != null && user.getSuspendedUntil().isAfter(LocalDateTime.now())) {
            String until = user.getSuspendedUntil().toLocalDate().toString();
            throw new ApiException("auth.suspended", until + "까지 이용이 제한된 계정이에요.", java.util.Map.of("untilDate", until));
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

    private String randomAvatarColor() {
        return AVATAR_PASTEL_COLORS[AVATAR_COLOR_RANDOM.nextInt(AVATAR_PASTEL_COLORS.length)];
    }
}
