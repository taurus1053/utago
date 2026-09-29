package com.utago.content;

import com.utago.ai.TranslationService;
import com.utago.common.Lang;
import com.utago.content.dto.CreateSongRequest;
import com.utago.content.dto.SongDetailResponse;
import com.utago.content.dto.SongLookupResponse;
import com.utago.content.dto.SongSummaryResponse;
import com.utago.content.dto.TranslateLinesRequest;
import com.utago.content.dto.TranslateLinesResponse;
import com.utago.content.dto.UpdateLinesRequest;
import com.utago.content.dto.UpdateSyncRequest;
import com.utago.translation.LineTranslationCacheService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class SongController {

    private final SongService songService;
    private final TranslationService translationService;
    private final LineTranslationCacheService lineTranslationCacheService;

    @GetMapping("/api/songs")
    public Page<SongSummaryResponse> listSongs(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Lang lang,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return songService.listSongs(query, lang, pageable);
    }

    @GetMapping("/api/songs/my")
    public ResponseEntity<Page<SongSummaryResponse>> listMySongs(
            @PageableDefault(size = 20) Pageable pageable,
            Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(songService.listMySongs(userId, pageable));
    }

    @GetMapping("/api/songs/{id}")
    public ResponseEntity<SongDetailResponse> getSong(
            @PathVariable Long id, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        return ResponseEntity.ok(songService.getSongDetail(id, userId));
    }

    @GetMapping("/api/songs/lookup")
    public ResponseEntity<SongLookupResponse> lookupByYoutube(
            @RequestParam String youtubeVideoId, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        return ResponseEntity.ok(songService.lookupByYoutube(youtubeVideoId, userId));
    }

    /**
     * POST /api/songs/translate-lines (로그인 필요)
     * "AI 번역 초안 받기" — 자동 저장 없음. 사용자가 검토/수정 후 POST /api/songs로 제출.
     *
     * 줄 단위 번역 캐시(LineTranslationCacheService)를 먼저 확인한다 — 같은 원문 줄이
     * 이미 캐시에 있으면(운영진이 미리 넣어둔 검수 번역 또는 예전 AI 번역 결과) 그대로
     * 재사용하고, 캐시에 없는 줄만 실제로 Claude를 호출한다. 새로 번역된 줄은 다음에
     * 또 나올 때 재사용할 수 있도록 캐시에 저장해둔다.
     *
     * Claude API 키 미설정 시: 캐시만으로 전부 채워지면 그대로 성공 응답, 캐시에 없는
     * 줄이 하나라도 남으면 available=false (에러 아님, 수동 입력으로 진행 가능).
     */
    @PostMapping("/api/songs/translate-lines")
    public ResponseEntity<TranslateLinesResponse> translateLines(
            @Valid @RequestBody TranslateLinesRequest request,
            Authentication authentication
    ) {
        if (extractUserId(authentication) == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        List<String> lines = request.lines();
        Lang sourceLang = request.sourceLang();

        Map<String, String> cacheHits = lineTranslationCacheService.lookupBatch(lines, sourceLang);

        List<String> result = new ArrayList<>(lines.size());
        List<Integer> missIndexes = new ArrayList<>();
        List<String> missLines = new ArrayList<>();
        for (int i = 0; i < lines.size(); i++) {
            String normalized = lineTranslationCacheService.normalize(lines.get(i));
            String cached = cacheHits.get(normalized);
            if (cached != null) {
                result.add(cached);
            } else {
                result.add(null);
                missIndexes.add(i);
                missLines.add(lines.get(i));
            }
        }

        if (!missLines.isEmpty()) {
            if (!translationService.isAvailable()) {
                return ResponseEntity.ok(TranslateLinesResponse.unavailable());
            }
            List<String> aiTranslations = translationService.translateLines(missLines, sourceLang);
            if (aiTranslations.size() != missLines.size()) {
                return ResponseEntity.ok(TranslateLinesResponse.unavailable());
            }
            for (int j = 0; j < missIndexes.size(); j++) {
                result.set(missIndexes.get(j), aiTranslations.get(j));
            }
            lineTranslationCacheService.saveBatch(missLines, sourceLang, aiTranslations);
        }

        return ResponseEntity.ok(TranslateLinesResponse.of(result));
    }

    @PostMapping("/api/songs")
    public ResponseEntity<SongDetailResponse> createSong(
            @Valid @RequestBody CreateSongRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        SongDetailResponse created = songService.createSong(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /**
     * 가사 싱크(소절별 재생 구간) 저장/수정. 곡을 등록한 본인만 호출할 수 있다 — 다른 사람의
     * 곡이거나 로그인하지 않았으면 403/401. 요청한 사용자가 ADMIN이면 서비스 내부에서
     * SongSyncCache에도 함께 반영되어, 같은 유튜브 영상으로 다른 사용자가 곡을 새로 등록할
     * 때 이 타이밍을 그대로 재사용한다(SongService.updateLineTimings 참고).
     */
    @PutMapping("/api/songs/{id}/sync")
    public ResponseEntity<SongDetailResponse> updateSync(
            @PathVariable Long id,
            @Valid @RequestBody UpdateSyncRequest request,
            Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(songService.updateLineTimings(id, userId, request.lines()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    /**
     * 가사 내용(원문/의역) 수정. 곡을 등록한 본인만 호출할 수 있다 — 다른 사람의 곡이거나
     * 로그인하지 않았으면 403/401. 등록 후 오탈자를 발견했거나 잘못 입력한 가사를 고칠 때 쓴다
     * (타이밍 수정은 /sync 엔드포인트가 따로 담당).
     */
    @PutMapping("/api/songs/{id}/lines")
    public ResponseEntity<SongDetailResponse> updateLines(
            @PathVariable Long id,
            @RequestBody UpdateLinesRequest request,
            Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(songService.updateLineContent(id, userId, request.lines()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    private Long extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long userId) return userId;
        return null;
    }
}
