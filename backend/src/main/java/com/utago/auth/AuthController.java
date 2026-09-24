package com.utago.auth;

import com.utago.auth.dto.AuthResponse;
import com.utago.auth.dto.LoginRequest;
import com.utago.auth.dto.NicknameAvailabilityResponse;
import com.utago.auth.dto.RequestSignupCodeRequest;
import com.utago.auth.dto.ResendVerificationRequest;
import com.utago.auth.dto.SignupRequest;
import com.utago.auth.dto.SignupResponse;
import com.utago.auth.dto.VerifyEmailRequest;
import com.utago.auth.dto.VerifySignupCodeRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Validated
public class AuthController {

    private final AuthService authService;

    @GetMapping("/check-nickname")
    public ResponseEntity<NicknameAvailabilityResponse> checkNickname(
            @RequestParam
            @NotBlank
            @Size(min = 2, max = 12, message = "닉네임은 2자 이상 12자 이하여야 합니다.")
            @Pattern(
                    regexp = "^[a-zA-Z0-9\\uAC00-\\uD7A3\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF]+$",
                    message = "닉네임은 한글, 영문, 일본어, 숫자만 사용할 수 있습니다."
            )
            String nickname
    ) {
        return ResponseEntity.ok(authService.checkNickname(nickname));
    }

    /** 회원가입 1단계: 이메일로 인증코드 발송 (아직 계정은 만들지 않음). */
    @PostMapping("/request-signup-code")
    public ResponseEntity<Void> requestSignupCode(@Valid @RequestBody RequestSignupCodeRequest request) {
        authService.requestSignupCode(request);
        return ResponseEntity.ok().build();
    }

    /** 회원가입 1단계: 인증코드 확인. 통과하면 signup() 을 호출할 수 있는 상태가 됨. */
    @PostMapping("/verify-signup-code")
    public ResponseEntity<Void> verifySignupCode(@Valid @RequestBody VerifySignupCodeRequest request) {
        authService.verifySignupCode(request);
        return ResponseEntity.ok().build();
    }

    /** 회원가입 2단계: 이메일 인증이 끝난 뒤 나머지 정보로 계정 생성. */
    @PostMapping("/signup")
    public ResponseEntity<SignupResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.ok(authService.signup(request));
    }

    /** 구버전 흐름(가입 후 인증)에서 쓰이던 엔드포인트. 새 흐름에서는 더 이상 호출되지 않지만 하위 호환을 위해 유지. */
    @PostMapping("/verify-email")
    public ResponseEntity<Void> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        authService.verifyEmail(request);
        return ResponseEntity.ok().build();
    }

    /** 구버전 흐름에서 쓰이던 엔드포인트. 새 흐름에서는 더 이상 호출되지 않지만 하위 호환을 위해 유지. */
    @PostMapping("/resend-verification")
    public ResponseEntity<Void> resendVerification(@Valid @RequestBody ResendVerificationRequest request) {
        authService.resendVerification(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
}
