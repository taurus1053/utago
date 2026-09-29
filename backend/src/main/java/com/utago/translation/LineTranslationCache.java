package com.utago.translation;

import com.utago.common.Lang;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * 원문 한 소절 -> 번역 캐시. (sourceLang, textHash) 조합이 유일 키 — 같은 원문 줄이 여러
 * 곡/여러 사용자에게 반복 등장해도 AI를 다시 돌리지 않고 재사용한다.
 *
 * source=ADMIN: 운영진이 미리 직접 넣어둔 검수된 번역(항상 우선, AI가 덮어쓰지 않음).
 * source=AI: "번역 초안 받기" 호출 중 캐시에 없어서 실제로 Claude를 돌린 결과 — 이후 같은
 * 줄이 또 나오면 재사용된다.
 */
@Entity
@Table(name = "line_translation_cache",
        uniqueConstraints = @UniqueConstraint(name = "uq_line_translation_cache_lang_hash",
                columnNames = {"source_lang", "text_hash"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LineTranslationCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_lang", nullable = false, length = 8)
    private Lang sourceLang;

    /** originalText의 SHA-256 해시(hex) — 긴 텍스트에 유니크 인덱스를 걸기 위한 키. */
    @Column(name = "text_hash", nullable = false, length = 64)
    private String textHash;

    @Lob
    @Column(name = "original_text", nullable = false, columnDefinition = "LONGTEXT")
    private String originalText;

    @Lob
    @Column(name = "translation_text", nullable = false, columnDefinition = "LONGTEXT")
    private String translationText;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private TranslationSource source;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
