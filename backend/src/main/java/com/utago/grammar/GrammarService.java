package com.utago.grammar;

import com.utago.content.GrammarPoint;
import com.utago.content.GrammarPointRepository;
import com.utago.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * /grammar 화면(레벨별 목록/상세/학습 체크)의 조회·사용자 상태 담당 — AI 생성(GrammarEntryService)
 * 과는 책임을 분리했다(TranslationService(AI 호출) / LineTranslationCacheService(데이터 조회)
 * 관계와 같은 구조).
 */
@Service
@RequiredArgsConstructor
public class GrammarService {

    private final GrammarEntryRepository grammarEntryRepository;
    private final UserGrammarProgressRepository userGrammarProgressRepository;
    private final GrammarPointRepository grammarPointRepository;
    private final UserRepository userRepository;

    public List<GrammarEntryResponse> listByLevel(GrammarLevel level, Long userId) {
        List<GrammarEntry> entries = grammarEntryRepository.findByLevelOrderByIdAsc(level);
        Set<Long> learnedIds = learnedEntryIds(userId, entries);
        return entries.stream()
                .map(e -> GrammarEntryResponse.of(e, learnedIds.contains(e.getId())))
                .toList();
    }

    public GrammarEntryDetailResponse getDetail(Long entryId, Long userId) {
        GrammarEntry entry = grammarEntryRepository.findById(entryId)
                .orElseThrow(() -> new IllegalArgumentException("문법 항목을 찾을 수 없습니다: " + entryId));

        boolean learned = userId != null
                && userGrammarProgressRepository.findByUser_IdAndGrammarEntry_Id(userId, entryId)
                        .map(UserGrammarProgress::isLearned)
                        .orElse(false);

        List<GrammarPoint> points = grammarPointRepository.findByGrammarEntry_Id(entryId);
        List<GrammarSongRef> songs = points.stream()
                // 같은 곡이 여러 소절에서 같은 문법을 썼더라도 중복 없이 한 번만.
                .collect(Collectors.toMap(
                        gp -> gp.getSong().getId(),
                        gp -> new GrammarSongRef(gp.getSong().getId(), gp.getSong().getTitle(), gp.getSong().getArtist()),
                        (a, b) -> a,
                        java.util.LinkedHashMap::new
                ))
                .values().stream().toList();

        return GrammarEntryDetailResponse.of(entry, learned, songs);
    }

    @Transactional
    public GrammarEntryDetailResponse setLearned(Long entryId, Long userId, boolean learned) {
        GrammarEntry entry = grammarEntryRepository.findById(entryId)
                .orElseThrow(() -> new IllegalArgumentException("문법 항목을 찾을 수 없습니다: " + entryId));

        UserGrammarProgress progress = userGrammarProgressRepository
                .findByUser_IdAndGrammarEntry_Id(userId, entryId)
                .orElseGet(() -> UserGrammarProgress.builder()
                        .user(userRepository.getReferenceById(userId))
                        .grammarEntry(entry)
                        .build());
        progress.setLearned(learned);
        progress.setUpdatedAt(java.time.LocalDateTime.now());
        userGrammarProgressRepository.save(progress);

        return getDetail(entryId, userId);
    }

    private Set<Long> learnedEntryIds(Long userId, List<GrammarEntry> entries) {
        if (userId == null || entries.isEmpty()) {
            return Set.of();
        }
        List<Long> ids = entries.stream().map(GrammarEntry::getId).toList();
        Map<Long, Boolean> byEntryId = new HashMap<>();
        for (UserGrammarProgress p : userGrammarProgressRepository.findByUser_IdAndGrammarEntry_IdIn(userId, ids)) {
            if (p.isLearned()) {
                byEntryId.put(p.getGrammarEntry().getId(), true);
            }
        }
        return byEntryId.keySet();
    }
}
