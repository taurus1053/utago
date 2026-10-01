package com.utago.dictionary;

import com.utago.user.Role;
import com.utago.user.User;
import com.utago.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 단어장 "단어 추가" 입력 시 바로바로 뜻이 채워지도록, JMdict 상용어를 마스터 사전에
 * 미리 만들어두는 관리자 전용 기능(DictionarySeedService 참고). ADMIN 여부 확인 방식은
 * AdminSongController와 동일.
 */
@RestController
@RequestMapping("/api/admin/dictionary")
@RequiredArgsConstructor
public class AdminDictionaryController {

    private final DictionarySeedService dictionarySeedService;
    private final UserRepository userRepository;

    /**
     * 한 번 호출할 때마다 최대 batchSize개만 새로 채운다(기본 200) — 비용이 드는 작업이라
     * 관리자가 상황을 보며 여러 번 나눠 호출하도록. seeded가 0이면 더 채울 단어가 없다는 뜻.
     */
    @PostMapping("/seed")
    public ResponseEntity<DictionarySeedBatchResponse> seed(
            @RequestParam(defaultValue = "200") int batchSize,
            Authentication authentication
    ) {
        HttpStatus failure = adminCheckFailure(authentication);
        if (failure != null) return ResponseEntity.status(failure).build();
        int capped = Math.max(1, Math.min(batchSize, 500));
        return ResponseEntity.ok(new DictionarySeedBatchResponse(dictionarySeedService.seedNextBatch(capped)));
    }

    private HttpStatus adminCheckFailure(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return HttpStatus.UNAUTHORIZED;
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getRole() != Role.ADMIN) return HttpStatus.FORBIDDEN;
        return null;
    }

    private Long extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long userId) return userId;
        return null;
    }
}
