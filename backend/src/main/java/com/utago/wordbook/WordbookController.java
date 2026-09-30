package com.utago.wordbook;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/wordbooks")
@RequiredArgsConstructor
public class WordbookController {

    private final WordbookService wordbookService;

    @GetMapping
    public ResponseEntity<List<WordbookResponse>> list(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(wordbookService.listWordbooks(userId));
    }

    @PostMapping
    public ResponseEntity<WordbookResponse> create(
            @RequestBody CreateWordbookRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (request.name() == null || request.name().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(wordbookService.createWordbook(userId, request.name().trim(), request.folderId()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            wordbookService.deleteWordbook(userId, id);
            return ResponseEntity.noContent().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @PatchMapping("/{id}/name")
    public ResponseEntity<WordbookResponse> rename(
            @PathVariable Long id, @RequestBody RenameRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (request.name() == null || request.name().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            return ResponseEntity.ok(wordbookService.renameWordbook(userId, id, request.name().trim()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @PatchMapping("/{id}/folder")
    public ResponseEntity<WordbookResponse> move(
            @PathVariable Long id, @RequestBody MoveWordbookRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(wordbookService.moveWordbookToFolder(userId, id, request.folderId()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @GetMapping("/{id}/items")
    public ResponseEntity<List<WordbookItemResponse>> items(@PathVariable Long id, Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(wordbookService.listItems(userId, id));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @PostMapping("/items")
    public ResponseEntity<WordbookItemResponse> addItem(
            @RequestBody AddWordbookItemRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (request.lemma() == null || request.lemma().isBlank() || request.lang() == null) {
            return ResponseEntity.badRequest().build();
        }
        try {
            return ResponseEntity.ok(
                    wordbookService.addItem(userId, request.lemma(), request.lang(), request.wordbookId()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    /**
     * 곡 학습 화면에서 소절의 단어들을 한 번에 조회 — 각 단어(lemma)가 내 단어장 중
     * 어디(어느 wordbookId)에 이미 담겨 있는지. 페이지를 나갔다 다시 들어와도 체크 표시가
     * 유지되도록, 소절이 바뀔 때마다 프론트에서 호출한다.
     */
    @PostMapping("/items/membership")
    public ResponseEntity<Map<String, List<Long>>> membership(
            @RequestBody WordMembershipRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(wordbookService.findWordbookIdsContainingBatch(userId, request.lemmas(), request.lang()));
    }

    /**
     * 홈 화면 "단어 복습하기" 카드 — 단어장에 담긴 단어 중 무작위로 하나. 담긴 단어가
     * 하나도 없으면(단어장이 전부 비어있으면) 204.
     */
    @GetMapping("/items/random")
    public ResponseEntity<WordbookItemResponse> randomItem(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return wordbookService.getRandomItem(userId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<Void> removeItem(@PathVariable Long itemId, Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            wordbookService.removeItem(userId, itemId);
            return ResponseEntity.noContent().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @PatchMapping("/items/{itemId}/star")
    public ResponseEntity<WordbookItemResponse> toggleStar(@PathVariable Long itemId, Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(wordbookService.toggleStar(userId, itemId));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @PostMapping("/items/{itemId}/review")
    public ResponseEntity<WordbookItemResponse> review(
            @PathVariable Long itemId,
            @RequestBody ReviewWordbookItemRequest request,
            Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(wordbookService.review(userId, itemId, request.know()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @GetMapping("/folders")
    public ResponseEntity<List<WordbookFolderResponse>> listFolders(Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(wordbookService.listFolders(userId));
    }

    @PostMapping("/folders")
    public ResponseEntity<WordbookFolderResponse> createFolder(
            @RequestBody CreateWordbookFolderRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (request.name() == null || request.name().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(wordbookService.createFolder(userId, request.name().trim()));
    }

    @PatchMapping("/folders/{id}")
    public ResponseEntity<WordbookFolderResponse> renameFolder(
            @PathVariable Long id, @RequestBody RenameRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (request.name() == null || request.name().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            return ResponseEntity.ok(wordbookService.renameFolder(userId, id, request.name().trim()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @DeleteMapping("/folders/{id}")
    public ResponseEntity<Void> deleteFolder(@PathVariable Long id, Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            wordbookService.deleteFolder(userId, id);
            return ResponseEntity.noContent().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    private Long extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long userId) return userId;
        return null;
    }
}
