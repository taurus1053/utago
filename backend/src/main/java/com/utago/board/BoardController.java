package com.utago.board;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * "단어장 둘러보기" 게시판 — claude/소셜_마이페이지_기획.md 2-2 API 설계 참고. 저장(북마크)
 * 토글(POST .../save)과 "내가 올린 글"/"저장한 글" 목록(마이페이지용)은 있지만, 저장글의
 * 폴더별 분류는 아직 없다(V22 마이그레이션 주석 참고).
 */
@RestController
@RequestMapping("/api/board")
@RequiredArgsConstructor
public class BoardController {

    private final WordbookPostService wordbookPostService;

    @GetMapping("/posts")
    public ResponseEntity<Page<PostSummaryResponse>> list(
            @RequestParam(defaultValue = "latest") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication
    ) {
        // SecurityConfig가 다른 라우트와 마찬가지로 전부 로그인 필수(anyRequest().authenticated())로
        // 막아두므로, 여기도 비로그인 열람은 애초에 들어오지 못한다 — userId는 항상 non-null.
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(wordbookPostService.listPosts(sort, page, size, userId));
    }

    /** 마이페이지 "내가 올린 게시글". */
    @GetMapping("/posts/mine")
    public ResponseEntity<List<PostSummaryResponse>> listMine(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(wordbookPostService.listMyPosts(userId));
    }

    /** 마이페이지 "저장한 게시글". */
    @GetMapping("/saved")
    public ResponseEntity<List<PostSummaryResponse>> listSaved(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(wordbookPostService.listSavedPosts(userId));
    }

    @GetMapping("/posts/{id}")
    public ResponseEntity<PostDetailResponse> get(@PathVariable Long id, Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(wordbookPostService.getPost(id, userId));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
        }
    }

    @PostMapping("/posts")
    public ResponseEntity<PostDetailResponse> create(
            @RequestBody CreatePostRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (request.wordbookId() == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(wordbookPostService.createPost(userId, request.wordbookId(), request.title(), request.body()));
    }

    /** 작성자 본인만 삭제 가능 — 소유권 위반은 403으로 remap. */
    @DeleteMapping("/posts/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            wordbookPostService.deletePost(userId, id);
            return ResponseEntity.noContent().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(null);
        }
    }

    @PostMapping("/posts/{id}/comments")
    public ResponseEntity<CommentResponse> addComment(
            @PathVariable Long id, @RequestBody CreateCommentRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(wordbookPostService.addComment(userId, id, request.content(), request.parentCommentId()));
    }

    /** 댓글 작성자 본인만 삭제 가능 — 소유권 위반은 403으로 remap. */
    @DeleteMapping("/posts/{postId}/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(
            @PathVariable Long postId, @PathVariable Long commentId, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            wordbookPostService.deleteComment(userId, commentId);
            return ResponseEntity.noContent().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(null);
        }
    }

    /** 좋아요 토글 — 누르면 추가, 다시 누르면 취소. 결과 상태를 그대로 내려준다. */
    @PostMapping("/posts/{id}/like")
    public ResponseEntity<Map<String, Boolean>> toggleLike(@PathVariable Long id, Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        boolean liked = wordbookPostService.toggleLike(userId, id);
        return ResponseEntity.ok(Map.of("liked", liked));
    }

    /** 저장(북마크) 토글 — 누르면 추가, 다시 누르면 취소. 결과 상태를 그대로 내려준다. */
    @PostMapping("/posts/{id}/save")
    public ResponseEntity<Map<String, Boolean>> toggleSave(@PathVariable Long id, Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        boolean saved = wordbookPostService.toggleSave(userId, id);
        return ResponseEntity.ok(Map.of("saved", saved));
    }

    private Long extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long userId) return userId;
        return null;
    }
}
