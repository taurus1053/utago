package com.utago.user;

import com.utago.user.dto.UpdateProfileRequest;
import com.utago.user.dto.UserProfileResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> me(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(userService.getProfile(userId));
    }

    @PatchMapping("/me")
    public ResponseEntity<UserProfileResponse> updateMe(
            Authentication authentication,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(userService.updateProfile(userId, request));
    }

    /**
     * GET /api/users/me/role — 프런트에서 관리자 페이지 노출 여부를 판단하기 위한 용도.
     * UserProfileResponse(별도 dto 파일, 이미 다른 화면에서 쓰이는 구조)는 건드리지 않고
     * 가볍게 role만 별도로 내려준다.
     */
    @GetMapping("/me/role")
    public ResponseEntity<RoleResponse> myRole(Authentication authentication) {
        Long userId = (Long) authentication.getPrincipal();
        return ResponseEntity.ok(new RoleResponse(userService.getRole(userId)));
    }

    public record RoleResponse(String role) {}
}
