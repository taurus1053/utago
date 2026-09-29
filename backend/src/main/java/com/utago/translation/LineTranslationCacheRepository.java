package com.utago.translation;

import com.utago.common.Lang;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface LineTranslationCacheRepository extends JpaRepository<LineTranslationCache, Long> {

    List<LineTranslationCache> findBySourceLangAndTextHashIn(Lang sourceLang, Collection<String> textHashes);

    boolean existsBySourceLangAndTextHash(Lang sourceLang, String textHash);

    /* 관리자 페이지 — 목록/검색용. */
    Page<LineTranslationCache> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<LineTranslationCache> findBySourceLangOrderByCreatedAtDesc(Lang sourceLang, Pageable pageable);

    Page<LineTranslationCache> findByOriginalTextContainingIgnoreCaseOrderByCreatedAtDesc(
            String query, Pageable pageable);

    Page<LineTranslationCache> findBySourceLangAndOriginalTextContainingIgnoreCaseOrderByCreatedAtDesc(
            Lang sourceLang, String query, Pageable pageable);
}
