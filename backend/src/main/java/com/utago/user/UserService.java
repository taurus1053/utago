package com.utago.user;

import com.utago.common.ApiException;
import com.utago.user.dto.UpdateProfileRequest;
import com.utago.user.dto.UserProfileResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(Long userId) {
        User user = findUser(userId);
        return UserProfileResponse.from(user);
    }

    @Transactional
    public UserProfileResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = findUser(userId);

        if (request.nickname() != null && !request.nickname().isBlank()) {
            user.setNickname(request.nickname());
        }
        if (request.nativeLang() != null) {
            user.setNativeLang(request.nativeLang());
        }

        return UserProfileResponse.from(user);
    }

    @Transactional(readOnly = true)
    public String getRole(Long userId) {
        return findUser(userId).getRole().name();
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException("user.notFound", "사용자를 찾을 수 없습니다."));
    }
}
