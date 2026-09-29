package com.utago.translation;

import com.utago.common.Lang;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * "AI 번역 초안 받기" 호출 시 원문 줄 단위 번역 캐시. 같은 원문 줄(같은 언어)이 이미
 * 캐시에 있으면(운영진이 미리 넣어뒀거나, 예전에 AI가 번역해서 저장해둔 것) 그대로
 * 재사용하고, 캐시에 없는 줄만 실제로 Claude API를 호출한다 — 응답 속도/비용 절감 +
 * 자주 등장하는 유명 소절의 번역 품질을 운영진이 직접 관리할 수 있게 해준다.
 *
 * 주의: 이 캐시는 (원문, 언어) 기준으로 전역 공유된다 — 즉 A가 등록한 곡과 B가 따로
 * 등록한 곡의 가사가 한 줄이라도 같으면 번역이 재사용된다. 원문 가사 자체는 여전히
 * 각자의 PRIVATE 곡에만 저장되고 다른 사용자에게 노출되지 않지만, "번역문"은 이 캐시를
 * 통해 내부적으로 공유될 수 있다는 점은 설계상 트레이드오프로 인지하고 있어야 한다.
 *
 * 관리자 CRUD(search/upsertAdmin/updateTranslationText)는 AdminLineTranslationController
 * 전용 — 운영진이 관리자 페이지에서 직접 검수한 번역을 source=ADMIN으로 넣고 고친다.
 */
@Service
@RequiredArgsConstructor
public class LineTranslationCacheService {

    private final LineTranslationCacheRepository repository;

    public String normalize(String text) {
        return text == null ? "" : text.trim();
    }

    private String hash(String normalized) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(normalized.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    /**
     * @return 정규화된 원문 -> 캐시된 번역. 캐시에 없는 줄은 결과 맵에 포함되지 않는다.
     */
    public Map<String, String> lookupBatch(List<String> lines, Lang sourceLang) {
        List<String> normalized = lines.stream()
                .map(this::normalize)
                .filter(s -> !s.isBlank())
                .distinct()
                .toList();
        if (normalized.isEmpty()) {
            return Map.of();
        }
        Map<String, String> hashToNormalized = new HashMap<>();
        for (String n : normalized) {
            hashToNormalized.put(hash(n), n);
        }
        List<LineTranslationCache> found =
                repository.findBySourceLangAndTextHashIn(sourceLang, hashToNormalized.keySet());

        Map<String, String> result = new HashMap<>();
        for (LineTranslationCache c : found) {
            result.put(c.getOriginalText(), c.getTranslationText());
        }
        return result;
    }

    /**
     * AI가 새로 번역한 줄들을 캐시에 저장한다. 이미 캐시에 있는 줄(특히 ADMIN이 미리
     * 넣어둔 검수 번역)은 절대 덮어쓰지 않는다 — 호출 전에 lookupBatch로 걸러진 "진짜
     * 미스"만 넘겨주는 것이 정상 흐름이지만, 방어적으로 한 번 더 확인한다.
     */
    @Transactional
    public void saveBatch(List<String> lines, Lang sourceLang, List<String> translations) {
        for (int i = 0; i < lines.size() && i < translations.size(); i++) {
            String norm = normalize(lines.get(i));
            String translation = translations.get(i);
            if (norm.isBlank() || translation == null || translation.isBlank()) {
                continue;
            }
            String h = hash(norm);
            if (repository.existsBySourceLangAndTextHash(sourceLang, h)) {
                continue;
            }
            repository.save(LineTranslationCache.builder()
                    .sourceLang(sourceLang)
                    .textHash(h)
                    .originalText(norm)
                    .translationText(translation.trim())
                    .source(TranslationSource.AI)
                    .build());
        }
    }

    /* ---- 관리자 페이지 전용 ---- */

    @Transactional(readOnly = true)
    public Page<LineTranslationCache> search(Lang sourceLang, String query, Pageable pageable) {
        String q = (query == null || query.isBlank()) ? null : query.trim();
        if (sourceLang != null && q != null) {
            return repository.findBySourceLangAndOriginalTextContainingIgnoreCaseOrderByCreatedAtDesc(
                    sourceLang, q, pageable);
        }
        if (sourceLang != null) {
            return repository.findBySourceLangOrderByCreatedAtDesc(sourceLang, pageable);
        }
        if (q != null) {
            return repository.findByOriginalTextContainingIgnoreCaseOrderByCreatedAtDesc(q, pageable);
        }
        return repository.findAllByOrderByCreatedAtDesc(pageable);
    }

    /** 원문이 이미 캐시에 있으면(같은 언어) 번역만 갱신, 없으면 새로 만든다 — 항상 source=ADMIN. */
    @Transactional
    public LineTranslationCache upsertAdmin(Lang sourceLang, String originalText, String translationText) {
        String norm = normalize(originalText);
        String h = hash(norm);
        LineTranslationCache existing = repository.findBySourceLangAndTextHashIn(sourceLang, List.of(h))
                .stream().findFirst().orElse(null);
        if (existing != null) {
            existing.setTranslationText(translationText.trim());
            existing.setSource(TranslationSource.ADMIN);
            return repository.save(existing);
        }
        return repository.save(LineTranslationCache.builder()
                .sourceLang(sourceLang)
                .textHash(h)
                .originalText(norm)
                .translationText(translationText.trim())
                .source(TranslationSource.ADMIN)
                .build());
    }

    @Transactional
    public Optional<LineTranslationCache> updateTranslationText(Long id, String translationText) {
        return repository.findById(id).map(c -> {
            c.setTranslationText(translationText.trim());
            return repository.save(c);
        });
    }

    /**
     * 원문 여러 줄 + 번역 여러 줄을 같은 순서로 짝지어 한 번에 upsertAdmin 한다.
     * 두 리스트 길이가 다르면 공통 길이까지만 처리한다(호출부에서 미리 개수를 맞추는 게 정상 흐름).
     */
    @Transactional
    public List<LineTranslationCache> upsertAdminBatch(Lang sourceLang, List<String> originalLines, List<String> translationLines) {
        List<LineTranslationCache> saved = new java.util.ArrayList<>();
        int n = Math.min(originalLines.size(), translationLines.size());
        for (int i = 0; i < n; i++) {
            String original = originalLines.get(i);
            String translation = translationLines.get(i);
            if (original == null || original.isBlank() || translation == null || translation.isBlank()) {
                continue;
            }
            saved.add(upsertAdmin(sourceLang, original, translation));
        }
        return saved;
    }
}
