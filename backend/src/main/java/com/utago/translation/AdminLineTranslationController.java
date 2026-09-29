package com.utago.translation;

import com.utago.common.Lang;
import com.utago.user.Role;
import com.utago.user.User;
import com.utago.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 운영진(ADMIN)이 소절 번역 캐시(line_translation_cache)를 직접 관리하는 화면용 API.
 * 여기서 만든 항목은 항상 source=ADMIN으로 저장되어, "AI 번역 초안 받기" 중에 캐시를
 * 채우는 자동 저장(LineTranslationCacheService.saveBatch)이 절대 덮어쓰지 않는다.
 *
 * 가사 원문/번역 내용은 로그인한 ADMIN 계정이 이 화면에서 직접 입력하는 것이며, 다른
 * 경로(Claude 채팅 등)를 거치지 않는다 — 관리자 페이지를 만든 이유 자체가 그것 때문.
 *
 * ADMIN 여부는 Spring Security 권한 체계(authorities)를 새로 도입하지 않고, 매 요청마다
 * UserRepository로 role을 직접 확인하는 방식으로 최소한으로 구현했다(SecurityConfig의
 * anyRequest().authenticated() 규칙이 이미 로그인 여부는 걸러주므로, 여기서는 ADMIN인지만
 * 추가로 확인).
 */
@RestController
@RequestMapping("/api/admin/line-translations")
@RequiredArgsConstructor
public class AdminLineTranslationController {

    private final LineTranslationCacheService cacheService;
    private final LineTranslationCacheRepository cacheRepository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<Page<LineTranslationDto>> list(
            @RequestParam(required = false) Lang sourceLang,
            @RequestParam(required = false) String query,
            @PageableDefault(size = 30) Pageable pageable,
            Authentication authentication
    ) {
        HttpStatus failure = adminCheckFailure(authentication);
        if (failure != null) return ResponseEntity.status(failure).build();

        Page<LineTranslationCache> page = cacheService.search(sourceLang, query, pageable);
        return ResponseEntity.ok(page.map(LineTranslationDto::from));
    }

    /** 새 항목 등록 또는(같은 원문+언어가 이미 있으면) 번역 갱신. */
    @PostMapping
    public ResponseEntity<LineTranslationDto> upsert(
            @Valid @RequestBody UpsertRequest request,
            Authentication authentication
    ) {
        HttpStatus failure = adminCheckFailure(authentication);
        if (failure != null) return ResponseEntity.status(failure).build();

        LineTranslationCache saved = cacheService.upsertAdmin(
                request.sourceLang(), request.originalText(), request.translationText());
        return ResponseEntity.ok(LineTranslationDto.from(saved));
    }

    /**
     * 원문 여러 줄 + 번역 여러 줄을 줄바꿈 기준으로 같은 순서로 짝지어 한 번에 upsert.
     * 공백 줄은 양쪽 다 필터링 후 순서대로 매칭 — 두 쪽의 "실제 내용 있는 줄" 개수가
     * 다르면 밀려서 잘못 매칭될 수 있으니 프론트에서 개수를 먼저 검증한다.
     */
    @PostMapping("/batch")
    public ResponseEntity<List<LineTranslationDto>> upsertBatch(
            @Valid @RequestBody BatchUpsertRequest request,
            Authentication authentication
    ) {
        HttpStatus failure = adminCheckFailure(authentication);
        if (failure != null) return ResponseEntity.status(failure).build();

        List<LineTranslationCache> saved = cacheService.upsertAdminBatch(
                request.sourceLang(), request.originalLines(), request.translationLines());
        return ResponseEntity.ok(saved.stream().map(LineTranslationDto::from).toList());
    }

    @PutMapping("/{id}")
    public ResponseEntity<LineTranslationDto> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateTranslationRequest request,
            Authentication authentication
    ) {
        HttpStatus failure = adminCheckFailure(authentication);
        if (failure != null) return ResponseEntity.status(failure).build();

        return cacheService.updateTranslationText(id, request.translationText())
                .map(saved -> ResponseEntity.ok(LineTranslationDto.from(saved)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        HttpStatus failure = adminCheckFailure(authentication);
        if (failure != null) return ResponseEntity.status(failure).build();

        cacheRepository.deleteById(id);
        return ResponseEntity.noContent().build();
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

    public record LineTranslationDto(
            Long id,
            Lang sourceLang,
            String originalText,
            String translationText,
            String source,
            String createdAt
    ) {
        static LineTranslationDto from(LineTranslationCache c) {
            return new LineTranslationDto(
                    c.getId(),
                    c.getSourceLang(),
                    c.getOriginalText(),
                    c.getTranslationText(),
                    c.getSource().name(),
                    c.getCreatedAt() == null ? null : c.getCreatedAt().toString()
            );
        }
    }

    public record UpsertRequest(
            @NotNull Lang sourceLang,
            @NotBlank String originalText,
            @NotBlank String translationText
    ) {}

    public record UpdateTranslationRequest(@NotBlank String translationText) {}

    public record BatchUpsertRequest(
            @NotNull Lang sourceLang,
            @NotNull List<String> originalLines,
            @NotNull List<String> translationLines
    ) {}
}
