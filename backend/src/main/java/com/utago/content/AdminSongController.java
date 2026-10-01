package com.utago.content;

import com.utago.content.dto.CreateSongRequest;
import com.utago.content.dto.SongDetailResponse;
import com.utago.user.Role;
import com.utago.user.User;
import com.utago.user.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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
 * 운영진(ADMIN)이 AI로 만든 "학습곡"(멜로디·보컬·가사를 AI로 제작한 뒤 관리자 유튜브 채널에
 * 올려 가져온 곡)을 공개 카탈로그에 바로 등록하는 화면용 API. 여기서 등록한 곡은 처음부터
 * PUBLIC + AI_GENERATED로 저장되어 "전체 곡" 섹션(GET /api/songs)에 즉시 노출된다 —
 * 일반 사용자 등록(POST /api/songs)은 항상 PRIVATE로 시작하는 것과 다르다.
 *
 * ADMIN 여부 확인 방식은 AdminLineTranslationController와 동일(Spring Security 권한 체계를
 * 새로 쓰지 않고, 매 요청마다 UserRepository로 role을 직접 확인).
 */
@RestController
@RequestMapping("/api/admin/songs")
@RequiredArgsConstructor
public class AdminSongController {

    private final SongService songService;
    private final UserRepository userRepository;

    @PostMapping
    public ResponseEntity<SongDetailResponse> createAiLearningSong(
            @Valid @RequestBody CreateSongRequest request,
            Authentication authentication
    ) {
        HttpStatus failure = adminCheckFailure(authentication);
        if (failure != null) return ResponseEntity.status(failure).build();

        SongDetailResponse created = songService.createAiLearningSong(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * 추천곡 관리 화면 — 제목/아티스트로 곡 검색(추천곡으로 지정할 곡을 찾기 위함, 공개
     * 범위 무관 전체 곡 대상). 검색어가 비어있으면 빈 목록.
     */
    @GetMapping("/search")
    public ResponseEntity<List<AdminSongSummaryResponse>> search(
            @RequestParam(required = false) String q,
            Authentication authentication
    ) {
        HttpStatus failure = adminCheckFailure(authentication);
        if (failure != null) return ResponseEntity.status(failure).build();
        return ResponseEntity.ok(songService.searchSongsForAdmin(q));
    }

    /** 추천곡 관리 화면 — 현재 홈 화면 "오늘의 추천곡" 후보로 지정된 곡 전체 목록. */
    @GetMapping("/featured")
    public ResponseEntity<List<AdminSongSummaryResponse>> listFeatured(Authentication authentication) {
        HttpStatus failure = adminCheckFailure(authentication);
        if (failure != null) return ResponseEntity.status(failure).build();
        return ResponseEntity.ok(songService.listFeaturedSongs());
    }

    /** 추천곡 관리 화면 — 곡 하나를 오늘의 추천곡 후보로 켜거나 끈다. */
    @PutMapping("/{songId}/featured")
    public ResponseEntity<AdminSongSummaryResponse> setFeatured(
            @PathVariable Long songId,
            @RequestBody FeaturedToggleRequest request,
            Authentication authentication
    ) {
        HttpStatus failure = adminCheckFailure(authentication);
        if (failure != null) return ResponseEntity.status(failure).build();
        // 유튜브 영상 없는 곡을 켜려다 던지는 IllegalStateException은 GlobalExceptionHandler가
        // {"message": ...} 담은 400으로 자동 변환해준다(다른 도메인 에러들과 동일한 패턴).
        return ResponseEntity.ok(songService.setFeatured(songId, request.featured()));
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
