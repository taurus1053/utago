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
}
