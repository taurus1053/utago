package com.utago.wordbook;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.utago.common.Lang;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/wordbooks")
@RequiredArgsConstructor
public class WordbookController {

    private static final Logger log = LoggerFactory.getLogger(WordbookController.class);

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
                    .body(wordbookService.createWordbook(
                            userId, request.name().trim(), request.folderId(), request.emoji()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    /**
     * 단어장 목록 "⋮" 메뉴 — "공개 설정" 토글. 실패(즐겨찾기 단어장을 공개하려 함 등)는
     * GlobalExceptionHandler가 400 + { message }로 내려줘서 화면에 그대로 보여준다.
     */
    @PatchMapping("/{id}/visibility")
    public ResponseEntity<WordbookResponse> setVisibility(
            @PathVariable Long id, @RequestBody VisibilityRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(wordbookService.setVisibility(userId, id, request.visible()));
    }

    /** 단어장 카드 아이콘 변경. */
    @PatchMapping("/{id}/emoji")
    public ResponseEntity<WordbookResponse> updateEmoji(
            @PathVariable Long id, @RequestBody EmojiRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(wordbookService.updateEmoji(userId, id, request.emoji()));
    }

    /**
     * 단어장 다운로드(스냅샷 복사) — 공개되거나 공식인 단어장을 내 단어장에 통째로 추가.
     * 게시판 화면의 "내 단어장에 추가" 버튼에서 호출 예정(게시판 자체는 Phase 2).
     */
    @PostMapping("/{id}/download")
    public ResponseEntity<WordbookResponse> download(@PathVariable Long id, Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.status(HttpStatus.CREATED).body(wordbookService.downloadWordbook(userId, id));
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
    public ResponseEntity<?> items(@PathVariable Long id, Authentication authentication) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(wordbookService.listItems(userId, id));
        } catch (IllegalStateException e) {
            // 소유권 체크 실패(단어장 없음/본인 것 아님) — 원래 메시지를 그대로 내려줘서
            // 디버깅 중엔 브라우저 네트워크 탭에서 바로 원인을 볼 수 있게 한다.
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            // AI 예문 생성 등 외부 호출 실패는 서비스 쪽에서 이미 흡수하지만, 혹시 모를
            // 다른 예기치 못한 오류는 403이 아니라 500으로 명확히 구분되게 하고 로그를 남긴다.
            log.error("[WordbookController] 단어장 항목 조회 중 예기치 못한 오류 (wordbookId={})", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "단어장을 불러오는 중 문제가 발생했어요."));
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
     * 단어장 화면 "단어 추가" 창 — 단어(lemma) 입력칸에서 디바운스로 호출하는 자동 조회.
     * 발음/뜻 입력칸을 자동으로 채워주는 미리보기일 뿐, 아무것도 저장/담지 않는다.
     */
    @GetMapping("/items/lookup")
    public ResponseEntity<WordLookupResponse> lookupWord(
            @RequestParam String lemma,
            @RequestParam(required = false) Lang lang,
            Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(wordbookService.lookupWord(lemma, lang == null ? Lang.JA : lang));
    }

    /**
     * 단어장 화면 "단어 직접 추가" — 가사에 없는 단어를 직접 입력해서 담는다. reading/meanings는
     * 보통 위 lookup으로 자동 채워진 뒤 사용자가 확인/수정한 최종 값 — 비어있지 않으면 그대로
     * 저장한다(다시 AI를 부르지 않음). 에러(사전에도 없고 직접 입력도 안 한 단어 등)는
     * GlobalExceptionHandler가 { message } 로 내려줘서 화면에 그대로 보여준다.
     */
    @PostMapping("/items/custom")
    public ResponseEntity<WordbookItemResponse> addCustomWord(
            @RequestBody AddCustomWordRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(wordbookService.addCustomWord(
                userId, request.lemma(),
                request.lang() == null ? Lang.JA : request.lang(),
                request.wordbookId(), request.reading(), request.meanings()));
    }

    /**
     * 단어장 목록 화면 "수정" — 오타/잘못 입력한 발음·뜻을 고친다. 에러(발음/뜻이 비어있음
     * 등)는 GlobalExceptionHandler가 { message } 로 내려줘서 화면에 그대로 보여준다.
     */
    @PatchMapping("/items/{itemId}/word")
    public ResponseEntity<WordbookItemResponse> updateItemWord(
            @PathVariable Long itemId, @RequestBody UpdateWordbookItemWordRequest request, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(
                wordbookService.updateItemWordDetails(userId, itemId, request.reading(), request.meanings()));
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
