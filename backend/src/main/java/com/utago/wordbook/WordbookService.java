package com.utago.wordbook;

import com.utago.common.Lang;
import com.utago.content.Visibility;
import com.utago.dictionary.JMdictLookupService;
import com.utago.dictionary.SongLineWord;
import com.utago.dictionary.SongLineWordRepository;
import com.utago.dictionary.Word;
import com.utago.dictionary.WordExample;
import com.utago.dictionary.WordExampleService;
import com.utago.dictionary.WordMeaning;
import com.utago.dictionary.WordMeaningEnrichmentService;
import com.utago.dictionary.WordMeaningRepository;
import com.utago.dictionary.WordRepository;
import com.utago.user.User;
import com.utago.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WordbookService {

    private static final Logger log = LoggerFactory.getLogger(WordbookService.class);

    private static final String DEFAULT_WORDBOOK_NAME = "즐겨찾기";

    /** "안다"를 누를 때마다 진행하는 복습 간격(일) — 단순화된 SRS. 마지막 단계를 넘기면 MASTERED. */
    private static final int[] REVIEW_INTERVALS_DAYS = {1, 3, 7, 14, 30, 60};

    private final WordbookRepository wordbookRepository;
    private final WordbookItemRepository wordbookItemRepository;
    private final WordbookFolderRepository wordbookFolderRepository;
    private final WordRepository wordRepository;
    private final WordMeaningRepository wordMeaningRepository;
    private final SongLineWordRepository songLineWordRepository;
    private final UserRepository userRepository;
    private final WordExampleService wordExampleService;
    private final UserWordProgressRepository userWordProgressRepository;
    private final JMdictLookupService jmdictLookupService;
    private final WordMeaningEnrichmentService wordMeaningEnrichmentService;

    /** 계정마다 기본으로 하나씩 있어야 하는 "즐겨찾기" 단어장. 없으면 그 자리에서 만든다
     * (회원가입 시점에 미리 만들어두지 않고, 처음 필요할 때 지연 생성). */
    @Transactional
    public Wordbook getOrCreateFavoriteWordbook(Long userId) {
        return wordbookRepository.findByUserIdAndFavoriteDefaultTrue(userId).stream().findFirst()
                .orElseGet(() -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
                    return wordbookRepository.save(Wordbook.builder()
                            .user(user)
                            .name(DEFAULT_WORDBOOK_NAME)
                            .favoriteDefault(true)
                            .build());
                });
    }

    /** 단어장 목록 화면. 기본(즐겨찾기) 단어장이 맨 앞에 오도록 정렬. */
    @Transactional
    public List<WordbookResponse> listWordbooks(Long userId) {
        getOrCreateFavoriteWordbook(userId);
        List<Wordbook> books = wordbookRepository.findByUserId(userId);
        return books.stream()
                .sorted((a, b) -> Boolean.compare(b.isFavoriteDefault(), a.isFavoriteDefault()))
                .map(b -> WordbookResponse.of(b, wordbookItemRepository.findByWordbookId(b.getId()).size()))
                .toList();
    }

    @Transactional
    public WordbookResponse createWordbook(Long userId, String name, Long folderId, String emoji) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
        WordbookFolder folder = folderId != null ? requireOwnedFolder(userId, folderId) : null;
        Wordbook.WordbookBuilder builder = Wordbook.builder()
                .user(user)
                .name(name)
                .folder(folder)
                .favoriteDefault(false);
        if (emoji != null && !emoji.isBlank()) {
            builder.emoji(emoji.trim());
        }
        Wordbook saved = wordbookRepository.save(builder.build());
        return WordbookResponse.of(saved, 0);
    }

    /**
     * 단어장 공개/비공개 전환 — 단어장 목록 "⋮" 메뉴의 "공개 설정"에서 호출.
     * 비공개(PRIVATE)인 단어장은 게시판에 올릴 수 없고 다운로드(복사)도 안 된다.
     * 즐겨찾기 기본 단어장은 공개 대상에서 항상 제외(claude/소셜_마이페이지_기획.md 1-1 참고).
     */
    @Transactional
    public WordbookResponse setVisibility(Long userId, Long wordbookId, boolean makePublic) {
        Wordbook book = requireOwnedWordbook(userId, wordbookId);
        if (book.isFavoriteDefault() && makePublic) {
            throw new IllegalStateException("즐겨찾기 단어장은 공개할 수 없습니다.");
        }
        book.setVisibility(makePublic ? Visibility.PUBLIC : Visibility.PRIVATE);
        return WordbookResponse.of(book, wordbookItemRepository.findByWordbookId(book.getId()).size());
    }

    /** 단어장 카드 아이콘 변경. */
    @Transactional
    public WordbookResponse updateEmoji(Long userId, Long wordbookId, String emoji) {
        if (emoji == null || emoji.isBlank()) {
            throw new IllegalStateException("이모티콘을 입력해주세요.");
        }
        Wordbook book = requireOwnedWordbook(userId, wordbookId);
        book.setEmoji(emoji.trim());
        return WordbookResponse.of(book, wordbookItemRepository.findByWordbookId(book.getId()).size());
    }

    /**
     * 단어장 다운로드(스냅샷 복사) — 공개(PUBLIC) 또는 공식(official) 단어장을 내 계정으로
     * 통째로 복사해온다. 원본이 가리키는 Word(마스터 사전 데이터)는 그대로 재사용하고,
     * WordbookItem 행만 새로 만든다 — 이후 원본이 바뀌어도 내 복사본엔 반영되지 않는다
     * (claude/소셜_마이페이지_기획.md 1-2 참고).
     */
    @Transactional
    public WordbookResponse downloadWordbook(Long userId, Long sourceWordbookId) {
        Wordbook source = wordbookRepository.findById(sourceWordbookId)
                .orElseThrow(() -> new IllegalStateException("단어장을 찾을 수 없습니다."));
        if (!source.isOfficial() && source.getVisibility() != Visibility.PUBLIC) {
            throw new IllegalStateException("공개된 단어장만 내 단어장에 추가할 수 있습니다.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));

        Wordbook copy = wordbookRepository.save(Wordbook.builder()
                .user(user)
                .name(source.getName())
                .emoji(source.getEmoji())
                .favoriteDefault(false)
                .build());

        List<WordbookItem> sourceItems = wordbookItemRepository.findByWordbookId(source.getId());
        List<WordbookItem> copiedItems = sourceItems.stream()
                .map(item -> WordbookItem.builder()
                        .wordbook(copy)
                        .word(item.getWord())
                        .build())
                .toList();
        wordbookItemRepository.saveAll(copiedItems);

        source.setDownloadCount(source.getDownloadCount() + 1);

        return WordbookResponse.of(copy, copiedItems.size());
    }

    @Transactional
    public void deleteWordbook(Long userId, Long wordbookId) {
        Wordbook book = requireOwnedWordbook(userId, wordbookId);
        if (book.isFavoriteDefault()) {
            throw new IllegalStateException("기본 단어장은 삭제할 수 없습니다.");
        }
        wordbookRepository.delete(book);
    }

    /** 단어장 이름 변경. */
    @Transactional
    public WordbookResponse renameWordbook(Long userId, Long wordbookId, String name) {
        Wordbook book = requireOwnedWordbook(userId, wordbookId);
        book.setName(name);
        return WordbookResponse.of(book, wordbookItemRepository.findByWordbookId(book.getId()).size());
    }

    /** 단어장을 다른 폴더로 옮기거나(folderId != null), 폴더에서 뺀다(folderId == null). */
    @Transactional
    public WordbookResponse moveWordbookToFolder(Long userId, Long wordbookId, Long folderId) {
        Wordbook book = requireOwnedWordbook(userId, wordbookId);
        if (book.isFavoriteDefault()) {
            throw new IllegalStateException("기본 단어장은 폴더로 옮길 수 없습니다.");
        }
        WordbookFolder folder = folderId != null ? requireOwnedFolder(userId, folderId) : null;
        book.setFolder(folder);
        return WordbookResponse.of(book, wordbookItemRepository.findByWordbookId(book.getId()).size());
    }

    /** 폴더 목록. */
    public List<WordbookFolderResponse> listFolders(Long userId) {
        return wordbookFolderRepository.findByUserId(userId).stream()
                .map(WordbookFolderResponse::of)
                .toList();
    }

    @Transactional
    public WordbookFolderResponse createFolder(Long userId, String name) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
        WordbookFolder saved = wordbookFolderRepository.save(WordbookFolder.builder()
                .user(user)
                .name(name)
                .build());
        return WordbookFolderResponse.of(saved);
    }

    @Transactional
    public WordbookFolderResponse renameFolder(Long userId, Long folderId, String name) {
        WordbookFolder folder = requireOwnedFolder(userId, folderId);
        folder.setName(name);
        return WordbookFolderResponse.of(folder);
    }

    /** 폴더를 지우면, 그 안의 단어장들은 지우지 않고 "폴더 없음" 상태로 남긴다. */
    @Transactional
    public void deleteFolder(Long userId, Long folderId) {
        WordbookFolder folder = requireOwnedFolder(userId, folderId);
        List<Wordbook> members = wordbookRepository.findByFolderId(folderId);
        members.forEach(b -> b.setFolder(null));
        wordbookFolderRepository.delete(folder);
    }

    private WordbookFolder requireOwnedFolder(Long userId, Long folderId) {
        WordbookFolder folder = wordbookFolderRepository.findById(folderId)
                .orElseThrow(() -> new IllegalStateException("폴더를 찾을 수 없습니다."));
        if (!folder.getUser().getId().equals(userId)) {
            throw new IllegalStateException("본인의 폴더만 이용할 수 있습니다.");
        }
        return folder;
    }

    /** 단어장 상세(단어 목록/플래시카드) 화면. */
    public List<WordbookItemResponse> listItems(Long userId, Long wordbookId) {
        Wordbook book = requireOwnedWordbook(userId, wordbookId);
        List<WordbookItem> items = wordbookItemRepository.findByWordbookId(book.getId());
        return toResponses(userId, items);
    }

    /**
     * 곡 학습 화면 "단어장에 추가" 버튼. lemma+lang으로 마스터 사전(Word)을 찾아 연결한다
     * (곡 등록/형태소 분석 때 이미 만들어져 있는 단어여야 함). wordbookId가 없으면 기본
     * (즐겨찾기) 단어장에 담는다. 이미 그 단어장에 있는 단어면 새로 만들지 않고 그대로 반환
     * (uk_items_wordbook_word 중복 방지).
     */
    @Transactional
    public WordbookItemResponse addItem(Long userId, String lemma, Lang lang, Long wordbookId) {
        Word word = wordRepository.findByLemmaAndLang(lemma, lang)
                .orElseThrow(() -> new IllegalStateException("단어를 찾을 수 없습니다."));
        Wordbook book = wordbookId != null
                ? requireOwnedWordbook(userId, wordbookId)
                : getOrCreateFavoriteWordbook(userId);

        WordbookItem item = wordbookItemRepository.findByWordbookIdAndWordId(book.getId(), word.getId())
                .orElseGet(() -> wordbookItemRepository.save(WordbookItem.builder()
                        .wordbook(book)
                        .word(word)
                        .build()));
        return toResponses(userId, List.of(item)).get(0);
    }

    /**
     * 단어장 화면 "단어 추가" 창 — 단어(lemma) 입력칸에서 디바운스로 자동 호출하는 미리보기
     * 조회. 발음/뜻 입력칸을 자동으로 채워주는 용도로, 실제로 단어장에 담지는 않는다.
     *
     * 마스터 사전(Word)에 이미 있으면(지난 조회·시딩·가사 등록으로 이미 만들어져 있으면)
     * DB에서 바로 꺼내와 즉시 응답한다 — AI 호출이 없다. 없으면 JMdict에서 찾아 Claude
     * 번역까지 돌려서 응답하면서 그 결과를 마스터 사전에 같이 저장해둔다(다음에 누가 같은
     * 단어를 조회하거나 추가할 때는 캐시되어 즉시 응답됨). 사전에도 없으면 found=false —
     * 화면에서 "직접 입력해주세요" 안내를 보여주고 사용자가 발음/뜻을 손으로 채우면 된다.
     * (지금은 일본어만 자동 조회 지원 — 한국어/영어는 마스터 사전에 이미 있을 때만 응답)
     */
    @Transactional
    public WordLookupResponse lookupWord(String lemmaInput, Lang lang) {
        String lemma = lemmaInput == null ? "" : lemmaInput.trim();
        if (lemma.isEmpty() || lang == null) {
            return new WordLookupResponse(lemma, null, List.of(), false);
        }
        if (lang != Lang.JA) {
            Optional<Word> existing = wordRepository.findByLemmaAndLang(lemma, lang);
            if (existing.isEmpty()) {
                return new WordLookupResponse(lemma, null, List.of(), false);
            }
            return new WordLookupResponse(lemma, existing.get().getReading(), meaningTextsOf(existing.get()), true);
        }
        try {
            Word word = resolveOrCreateWord(lemma, lang, null, null);
            return new WordLookupResponse(lemma, word.getReading(), meaningTextsOf(word), true);
        } catch (IllegalStateException e) {
            return new WordLookupResponse(lemma, null, List.of(), false);
        }
    }

    private List<String> meaningTextsOf(Word word) {
        return wordMeaningRepository.findByWordIdOrderByDisplayOrderAsc(word.getId()).stream()
                .map(WordMeaning::getMeaningText)
                .toList();
    }

    /**
     * 단어장 화면 "단어 직접 추가" — 가사에 나온 적 없는 단어도 직접 입력해서 담는다.
     *
     * readingInput/meaningsInput — 자동 조회(lookupWord)로 채워졌거나 사용자가 고친 최종
     * 값. 비어있지 않으면 AI로 다시 만들지 않고 그대로 저장한다(사용자의 확인/수정이 최종
     * 값). 마스터 사전(Word)에 이미 있으면 그걸 재사용하되 이 값으로 갱신하고, 없으면
     * JMdict(상용어)에서 찾아 새로 만든다 — JMdict에도 없는 완전히 새 단어는 사용자가
     * 발음/뜻을 둘 다 직접 입력했을 때만 만들어준다(Word/WordMeaning은 모든 사용자가 공유
     * 하는 마스터 데이터라, 같은 단어를 나중에 다른 사용자가 고치면 전체에 반영된다).
     * (지금은 JMdict가 일본어뿐이라 사전에 없는 새 단어 생성은 일본어만 지원)
     */
    @Transactional
    public WordbookItemResponse addCustomWord(
            Long userId, String lemmaInput, Lang lang, Long wordbookId,
            String readingInput, List<String> meaningsInput
    ) {
        String lemma = lemmaInput == null ? "" : lemmaInput.trim();
        if (lemma.isEmpty()) {
            throw new IllegalStateException("추가할 단어를 입력해주세요.");
        }
        if (lemma.length() > 120) {
            throw new IllegalStateException("단어가 너무 길어요.");
        }
        // 새 단어를 만들기 전에 단어장 소유부터 확인 — 남의 단어장이면 아무것도 만들지 않는다.
        Wordbook book = wordbookId != null
                ? requireOwnedWordbook(userId, wordbookId)
                : getOrCreateFavoriteWordbook(userId);
        // 즐겨찾기는 "단어장에 담긴 단어 중 별표 누른 것"만 모이는 뷰라, 여기에 직접 단어를
        // 추가하는 건 허용하지 않는다(프론트에서 버튼 자체를 숨기지만, 서버에서도 한 번 더 막는다).
        if (book.isFavoriteDefault()) {
            throw new IllegalStateException("즐겨찾기에는 단어를 직접 추가할 수 없어요. 단어장에 추가한 뒤 별표를 눌러주세요.");
        }

        Word word = resolveOrCreateWord(lemma, lang, readingInput, meaningsInput);
        WordbookItem item = wordbookItemRepository.findByWordbookIdAndWordId(book.getId(), word.getId())
                .orElseGet(() -> wordbookItemRepository.save(WordbookItem.builder()
                        .wordbook(book)
                        .word(word)
                        .build()));
        // toResponses()가 아니라 가벼운 응답을 쓴다 — toResponses는 아직 예문이 없는 단어에
        // 대해 그 자리에서 AI로 예문을 만드는데(WordExampleService), 그건 "추가" 버튼을 누른
        // 순간 체감되는 지연의 주 원인이다. 예문은 다음에 단어장 목록을 열 때(listItems)
        // 자연스럽게 채워지므로, 추가 직후 응답에서는 생략해서 즉시 담기도록 한다.
        return toQuickResponse(item);
    }

    /**
     * @param explicitReading 사용자가 확인/수정한 발음. null/빈 값이면 기존 값 또는 자동 추정값 유지.
     * @param explicitMeanings 사용자가 확인/수정한 뜻 목록. null/빈 리스트면 AI 자동 채우기로 대체.
     */
    private Word resolveOrCreateWord(String lemma, Lang lang, String explicitReading, List<String> explicitMeanings) {
        Optional<Word> existing = wordRepository.findByLemmaAndLang(lemma, lang);
        if (existing.isPresent()) {
            applyOverrides(existing.get(), explicitReading, explicitMeanings);
            return existing.get();
        }
        if (lang != Lang.JA) {
            throw new IllegalStateException("지금은 일본어 단어만 직접 추가할 수 있어요.");
        }
        Optional<JMdictLookupService.Entry> entryOpt = jmdictLookupService.lookup(lemma, null);
        if (entryOpt.isPresent()) {
            JMdictLookupService.Entry entry = entryOpt.get();
            // 가사에서 이미 같은 단어가 가나로 입력돼 한자 표제어로 만들어져 있으면 그걸 쓴다
            // (가나 입력 → 한자 표제어로의 승격만 허용한다). 반대로 사용자가 지금 한자를 직접
            // 입력했는데 그 발음(가나) 표기로 이미 있는 단어를 억지로 재사용해버리면, 사용자가
            // 고른 한자 표기가 조용히 가나로 바뀌어버리는 문제가 생기므로 kana는 넣지 않는다.
            List<String> canonicalForms = new ArrayList<>();
            if (!entry.kanji().isEmpty()) canonicalForms.add(entry.kanji().get(0));
            for (String form : canonicalForms) {
                Optional<Word> sameWord = wordRepository.findByLemmaAndLang(form, lang);
                if (sameWord.isPresent()) {
                    applyOverrides(sameWord.get(), explicitReading, explicitMeanings);
                    return sameWord.get();
                }
            }

            String reading = explicitReading != null && !explicitReading.isBlank()
                    ? explicitReading.trim()
                    : (entry.kana().contains(lemma) ? lemma : (entry.kana().isEmpty() ? null : entry.kana().get(0)));
            String pos = entry.senses().isEmpty() ? null : entry.senses().get(0).pos();
            if (pos != null && pos.length() > 30) {
                pos = pos.substring(0, 30);
            }
            Word created = wordRepository.save(Word.builder()
                    .lemma(lemma)
                    .lang(lang)
                    .reading(reading)
                    .pos(pos)
                    .dictSource("JMdict")
                    .build());
            if (explicitMeanings != null && !explicitMeanings.isEmpty()) {
                replaceMeanings(created, explicitMeanings);
            } else {
                wordMeaningEnrichmentService.enrich(List.of(created));
            }
            return created;
        }

        // JMdict(상용어 3만 건)에도 없는 단어 — 사용자가 발음/뜻을 둘 다 직접 입력했을 때만 새로 만든다.
        boolean hasReading = explicitReading != null && !explicitReading.isBlank();
        boolean hasMeanings = explicitMeanings != null && !explicitMeanings.isEmpty();
        if (!hasReading || !hasMeanings) {
            throw new IllegalStateException("사전에서 찾을 수 없는 단어예요. 발음과 뜻을 직접 입력해주세요.");
        }
        Word created = wordRepository.save(Word.builder()
                .lemma(lemma)
                .lang(lang)
                .reading(explicitReading.trim())
                .dictSource("USER")
                .build());
        replaceMeanings(created, explicitMeanings);
        return created;
    }

    /** 이미 있는 단어에 사용자가 확인/수정한 값을 반영 — 값이 없으면 기존 값(또는 AI 자동 채우기) 유지. */
    private void applyOverrides(Word word, String explicitReading, List<String> explicitMeanings) {
        if (explicitReading != null && !explicitReading.isBlank()
                && !explicitReading.trim().equals(word.getReading())) {
            word.setReading(explicitReading.trim());
            wordRepository.save(word);
        }
        if (explicitMeanings != null && !explicitMeanings.isEmpty()) {
            replaceMeanings(word, explicitMeanings);
        } else {
            enrichIfNoMeaning(word);
        }
    }

    /** 뜻을 사용자가 입력한 값으로 통째로 교체(기존 뜻은 지움). 최대 5개, 중복/빈 값은 제거. */
    private void replaceMeanings(Word word, List<String> meanings) {
        List<String> cleaned = meanings.stream()
                .filter(m -> m != null)
                .map(String::trim)
                .filter(m -> !m.isEmpty())
                .distinct()
                .limit(5)
                .toList();
        if (cleaned.isEmpty()) {
            return;
        }
        wordMeaningRepository.deleteByWordId(word.getId());
        List<WordMeaning> toSave = new ArrayList<>();
        int order = 0;
        for (String meaning : cleaned) {
            toSave.add(WordMeaning.builder().word(word).meaningText(meaning).displayOrder(order++).build());
        }
        wordMeaningRepository.saveAll(toSave);
    }

    private void enrichIfNoMeaning(Word word) {
        if (wordMeaningRepository.findByWordIdOrderByDisplayOrderAsc(word.getId()).isEmpty()) {
            wordMeaningEnrichmentService.enrich(List.of(word));
        }
    }

    @Transactional
    public void removeItem(Long userId, Long itemId) {
        WordbookItem item = requireOwnedItem(userId, itemId);
        // 별표(즐겨찾기)는 같은 단어를 가리키는 "별도의" 항목 행(즐겨찾기 단어장 소속)으로
        // 구현돼 있다(toggleStar 참고) — 그래서 어느 쪽에서 삭제하든(원래 단어장이든 즐겨찾기
        // 든) 이 단어의 모든 항목 행을 함께 지운다. 안 그러면 한쪽만 지워져서, 원래 단어장
        // 에서 지웠는데 즐겨찾기엔 계속 남아있거나(또는 그 반대) 하는 상태가 된다.
        List<WordbookItem> allItemsForWord = wordbookItemRepository
                .findByWordbook_User_IdAndWordIdIn(userId, List.of(item.getWord().getId()));
        wordbookItemRepository.deleteAll(allItemsForWord);
    }

    /**
     * 곡 학습 화면 단어 목록 — 지금 보고 있는 소절의 단어들이 내 단어장 중 어디에 이미
     * 담겨 있는지 한 번에 조회한다(체크 표시를 페이지를 다시 들어와도 유지하기 위함).
     * @return lemma -> 그 단어가 담긴 단어장 id 목록
     */
    public Map<String, List<Long>> findWordbookIdsContainingBatch(Long userId, List<String> lemmas, Lang lang) {
        if (lemmas == null || lemmas.isEmpty() || lang == null) {
            return Map.of();
        }
        List<String> distinctLemmas = lemmas.stream().distinct().toList();
        List<Word> words = wordRepository.findByLemmaInAndLang(distinctLemmas, lang);
        if (words.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> lemmaByWordId = words.stream()
                .collect(Collectors.toMap(Word::getId, Word::getLemma));
        List<Long> wordIds = new ArrayList<>(lemmaByWordId.keySet());

        List<WordbookItem> items = wordbookItemRepository.findByWordbook_User_IdAndWordIdIn(userId, wordIds);
        Map<String, List<Long>> result = new HashMap<>();
        for (WordbookItem item : items) {
            String lemma = lemmaByWordId.get(item.getWord().getId());
            if (lemma == null) continue;
            result.computeIfAbsent(lemma, k -> new ArrayList<>()).add(item.getWordbook().getId());
        }
        return result;
    }

    /**
     * 별표(즐겨찾기) 토글. "단어장에서 별표를 누르면 즐겨찾기 폴더에도 들어간다"는 요구사항대로,
     * 즐겨찾기가 아닌 단어장에서 별표를 켜면 즐겨찾기 단어장에도 같은 단어를 복사해 넣고,
     * 끄면 즐겨찾기 단어장에서 그 항목을 뺀다. 즐겨찾기 단어장 자체에서 토글할 땐(이미 즐겨찾기
     * 안에 있는 항목이므로) 별표 값만 바꾸고 별도 동기화는 하지 않는다.
     */
    @Transactional
    public WordbookItemResponse toggleStar(Long userId, Long itemId) {
        WordbookItem item = requireOwnedItem(userId, itemId);
        boolean nowStarred = !item.isStarred();
        item.setStarred(nowStarred);

        if (!item.getWordbook().isFavoriteDefault()) {
            Wordbook favorite = getOrCreateFavoriteWordbook(userId);
            if (nowStarred) {
                wordbookItemRepository.findByWordbookIdAndWordId(favorite.getId(), item.getWord().getId())
                        .orElseGet(() -> wordbookItemRepository.save(WordbookItem.builder()
                                .wordbook(favorite)
                                .word(item.getWord())
                                .build()));
            } else {
                wordbookItemRepository.findByWordbookIdAndWordId(favorite.getId(), item.getWord().getId())
                        .ifPresent(wordbookItemRepository::delete);
            }
        }
        return toResponses(userId, List.of(item)).get(0);
    }

    /**
     * 홈 화면 "단어 복습하기" — 단어장에 있고 없고 상관없이, 내 단어장 전체(즐겨찾기 포함)에서
     * 무작위로 하나 뽑는다. 단어장에 담긴 단어가 하나도 없으면 empty.
     */
    public Optional<WordbookItemResponse> getRandomItem(Long userId) {
        return wordbookItemRepository.findRandomByUserId(userId)
                .map(item -> toResponses(userId, List.of(item)).get(0));
    }

    /**
     * 플래시카드 복습 결과 반영. "안다": 복습 간격을 다음 단계로 늘리고(1→3→7→14→30→60일),
     * 마지막 단계를 넘기면 MASTERED로 전환. "모른다": 처음(1일 뒤 재복습)으로 되돌린다.
     *
     * 진행 상태는 이 단어장 항목(itemId)이 아니라 "사용자+단어" 단위(UserWordProgress)에
     * 반영된다 — 같은 단어가 다른 단어장(즐겨찾기 포함)에도 담겨 있다면 거기서도 똑같이
     * 학습 횟수가 올라간 것으로 보인다.
     */
    @Transactional
    public WordbookItemResponse review(Long userId, Long itemId, boolean know) {
        WordbookItem item = requireOwnedItem(userId, itemId);
        UserWordProgress progress = getOrCreateProgress(userId, item.getWord());
        if (know) {
            int nextCount = progress.getRepetitionCount() + 1;
            progress.setRepetitionCount(nextCount);
            int idx = Math.min(nextCount - 1, REVIEW_INTERVALS_DAYS.length - 1);
            int intervalDays = REVIEW_INTERVALS_DAYS[idx];
            progress.setIntervalDays(intervalDays);
            progress.setNextReviewAt(LocalDateTime.now().plusDays(intervalDays));
            progress.setStatus(nextCount >= REVIEW_INTERVALS_DAYS.length
                    ? WordbookItemStatus.MASTERED
                    : WordbookItemStatus.LEARNING);
        } else {
            progress.setRepetitionCount(0);
            progress.setIntervalDays(1);
            progress.setNextReviewAt(LocalDateTime.now());
            progress.setStatus(WordbookItemStatus.LEARNING);
        }
        userWordProgressRepository.save(progress);
        return toResponses(userId, List.of(item)).get(0);
    }

    /** 단어 하나의 학습 진행 상태를 찾아오거나(없으면) 기본값으로 새로 만든다. */
    private UserWordProgress getOrCreateProgress(Long userId, Word word) {
        return userWordProgressRepository.findByUser_IdAndWord_Id(userId, word.getId())
                .orElseGet(() -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
                    return UserWordProgress.builder()
                            .user(user)
                            .word(word)
                            .build();
                });
    }

    private Wordbook requireOwnedWordbook(Long userId, Long wordbookId) {
        Wordbook book = wordbookRepository.findById(wordbookId)
                .orElseThrow(() -> new IllegalStateException("단어장을 찾을 수 없습니다."));
        if (!book.getUser().getId().equals(userId)) {
            throw new IllegalStateException("본인의 단어장만 이용할 수 있습니다.");
        }
        return book;
    }

    private WordbookItem requireOwnedItem(Long userId, Long itemId) {
        WordbookItem item = wordbookItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalStateException("항목을 찾을 수 없습니다."));
        if (!item.getWordbook().getUser().getId().equals(userId)) {
            throw new IllegalStateException("본인의 단어장만 수정할 수 있습니다.");
        }
        return item;
    }

    /**
     * 단어장 목록 화면 "수정" — 오타/잘못 입력한 발음·뜻을 고친다. 단어(lemma) 자체는 여기서
     * 고치지 않는다 — Word/WordMeaning은 여러 단어장(다른 사용자 포함)이 같이 쓰는 마스터
     * 데이터라, 표기(lemma)를 바꾸면 다른 Word와 합쳐지거나 충돌할 수 있어 범위 밖으로 뒀다
     * (단어 자체가 틀렸다면 삭제 후 다시 추가하는 걸 권장). 발음/뜻은 바꿔도 안전하다.
     */
    @Transactional
    public WordbookItemResponse updateItemWordDetails(Long userId, Long itemId, String readingInput, List<String> meaningsInput) {
        WordbookItem item = requireOwnedItem(userId, itemId);
        String reading = readingInput == null ? "" : readingInput.trim();
        if (reading.isEmpty()) {
            throw new IllegalStateException("발음을 입력해주세요.");
        }
        List<String> cleanedMeanings = meaningsInput == null ? List.of()
                : meaningsInput.stream().filter(m -> m != null && !m.isBlank()).toList();
        if (cleanedMeanings.isEmpty()) {
            throw new IllegalStateException("뜻을 입력해주세요.");
        }
        Word word = item.getWord();
        word.setReading(reading);
        wordRepository.save(word);
        replaceMeanings(word, cleanedMeanings);
        return toQuickResponse(item);
    }

    /**
     * toResponses()의 가벼운 버전 — 예문(WordExampleService)을 그 자리에서 AI로 만들지 않고
     * 생략한다. "단어 추가"/"수정" 직후처럼 응답 속도가 중요한 곳에서 쓴다. 예문은 다음에
     * 단어장 목록을 열 때(listItems → toResponses) 채워져서 그 뒤로는 계속 캐시된다.
     */
    private WordbookItemResponse toQuickResponse(WordbookItem item) {
        List<WordMeaning> meanings = wordMeaningRepository.findByWordIdOrderByDisplayOrderAsc(item.getWord().getId());
        List<String> similarLemmas = similarLemmasFor(item.getWord());
        return WordbookItemResponse.of(
                item, null, meanings,
                null, null, null, null, List.of(), List.of(), similarLemmas);
    }

    private List<WordbookItemResponse> toResponses(Long userId, List<WordbookItem> items) {
        if (items.isEmpty()) return List.of();
        List<Long> wordIds = items.stream().map(i -> i.getWord().getId()).distinct().toList();
        // 학습 진행 상태(SRS) — 사용자+단어 단위로 하나뿐이라, 같은 단어가 여러 단어장에
        // 담겨 있어도(즐겨찾기 포함) 항상 같은 학습 횟수/복습 주기를 보여준다.
        Map<Long, UserWordProgress> progressByWordId = userWordProgressRepository
                .findByUser_IdAndWord_IdIn(userId, wordIds).stream()
                .collect(Collectors.toMap(p -> p.getWord().getId(), p -> p));
        Map<Long, List<WordMeaning>> meaningsByWordId = wordMeaningRepository
                .findByWordIdInOrderByDisplayOrderAsc(wordIds).stream()
                .collect(Collectors.groupingBy(m -> m.getWord().getId()));
        // 단어당 예문(실제 가사 소절)은 여러 개일 수 있지만 하나만 있으면 충분하므로,
        // wordId당 첫 번째 것만 남긴다(다른 사용자의 PRIVATE 곡은 애초에 조회 대상에서 제외됨).
        Map<Long, SongLineWord> exampleByWordId = songLineWordRepository
                .findVisibleExamplesByWordIdIn(wordIds, userId).stream()
                .collect(Collectors.toMap(slw -> slw.getWord().getId(), slw -> slw, (a, b) -> a));
        // 문장 재배열 게임용 — 예문이 있는 단어들의 소절에 등장하는 "모든" 단어 구간을 한 번에
        // 불러온다(예문의 주인공 단어 하나만이 아니라, 그 소절 전체를 단어 단위로 쪼개기 위함).
        List<Long> lineIds = exampleByWordId.values().stream()
                .map(slw -> slw.getSongLine().getId())
                .distinct()
                .toList();
        Map<Long, List<SongLineWord>> lineWordsByLineId = lineIds.isEmpty() ? Map.of() : songLineWordRepository
                .findBySongLineIdIn(lineIds).stream()
                .collect(Collectors.groupingBy(w -> w.getSongLine().getId()));

        // 실제 가사 예문이 없는 단어들 — AI가 만든(또는 이미 만들어 저장해둔) 예문으로 대체한다.
        List<Word> wordsMissingLyricExample = items.stream()
                .map(WordbookItem::getWord)
                .filter(w -> !exampleByWordId.containsKey(w.getId()))
                .distinct()
                .toList();
        // AI 예문 생성은 외부 API(Claude) 동기 호출이라, 네트워크 문제나 API 오류가 나도
        // 단어장 목록 전체가 깨지면 안 된다 — 실패하면 그냥 그 단어들은 예문 없이 보여준다.
        Map<Long, WordExample> aiExampleByWordIdResult;
        try {
            aiExampleByWordIdResult = wordExampleService.getOrGenerateExamples(wordsMissingLyricExample);
        } catch (Exception e) {
            log.warn("[WordbookService] AI 예문 생성 실패 — 예문 없이 진행", e);
            aiExampleByWordIdResult = Map.of();
        }
        final Map<Long, WordExample> aiExampleByWordId = aiExampleByWordIdResult;

        return items.stream()
                .map(item -> {
                    Long wordId = item.getWord().getId();
                    SongLineWord example = exampleByWordId.get(wordId);
                    List<WordMeaning> meanings = meaningsByWordId.getOrDefault(wordId, List.of());

                    List<String> similarLemmas = similarLemmasFor(item.getWord());

                    if (example != null) {
                        List<SongLineWord> lineWords = lineWordsByLineId
                                .getOrDefault(example.getSongLine().getId(), List.of());
                        List<WordSpan> spans = lineWords.stream()
                                .sorted((a, b) -> Integer.compare(a.getCharOffsetStart(), b.getCharOffsetStart()))
                                .map(w -> new WordSpan(w.getCharOffsetStart(), w.getCharOffsetEnd()))
                                .toList();
                        return WordbookItemResponse.of(
                                item,
                                progressByWordId.get(wordId),
                                meanings,
                                example.getSongLine().getOriginalText(),
                                example.getCharOffsetStart(),
                                example.getCharOffsetEnd(),
                                example.getSongLine().getTranslationNatural(),
                                spans,
                                exampleWordsForLyric(lineWords),
                                similarLemmas);
                    }

                    WordExample aiExample = aiExampleByWordId.get(wordId);
                    if (aiExample != null) {
                        List<String> tokens = wordExampleService.parseTokens(aiExample.getTokensJson());
                        List<WordSpan> spans = tokensToSpans(tokens);
                        int[] ownSpan = tokens.isEmpty()
                                ? locateInText(aiExample.getExampleText(), item.getWord().getLemma())
                                : locateInTokens(tokens, item.getWord().getLemma());
                        return WordbookItemResponse.of(
                                item,
                                progressByWordId.get(wordId),
                                meanings,
                                aiExample.getExampleText(),
                                ownSpan == null ? null : ownSpan[0],
                                ownSpan == null ? null : ownSpan[1],
                                aiExample.getExampleTranslation(),
                                spans,
                                exampleWordsForAi(tokens, item.getWord().getLang()),
                                similarLemmas);
                    }

                    return WordbookItemResponse.of(
                            item, progressByWordId.get(wordId), meanings,
                            null, null, null, null, List.of(), List.of(), similarLemmas);
                })
                .toList();
    }

    /** 실제 가사 소절 예문 안의 단어들(사전에 매칭되는 것만)의 표제어/발음/뜻 목록. */
    private List<ExampleWord> exampleWordsForLyric(List<SongLineWord> lineWords) {
        if (lineWords.isEmpty()) return List.of();
        List<Long> wordIds = lineWords.stream().map(w -> w.getWord().getId()).distinct().toList();
        Map<Long, List<WordMeaning>> meaningsByWordId = wordMeaningRepository
                .findByWordIdInOrderByDisplayOrderAsc(wordIds).stream()
                .collect(Collectors.groupingBy(m -> m.getWord().getId()));
        return lineWords.stream()
                .sorted((a, b) -> Integer.compare(a.getCharOffsetStart(), b.getCharOffsetStart()))
                .map(w -> {
                    Word word = w.getWord();
                    List<String> wordMeanings = meaningsByWordId.getOrDefault(word.getId(), List.of()).stream()
                            .map(WordMeaning::getMeaningText)
                            .toList();
                    return wordMeanings.isEmpty() ? null : new ExampleWord(word.getLemma(), word.getReading(), wordMeanings);
                })
                .filter(w -> w != null)
                .toList();
    }

    /**
     * AI 생성 예문의 토큰들 중, 마스터 사전에 이미 있는 단어(주로 조사/어미가 아닌 내용어)만
     * 뜻과 함께 돌려준다 — 조사 같은 토큰은 사전에 없으니 자연히 빠진다.
     */
    private List<ExampleWord> exampleWordsForAi(List<String> tokens, Lang lang) {
        if (tokens.isEmpty()) return List.of();
        List<String> distinctTokens = tokens.stream().distinct().toList();
        List<Word> matched = wordRepository.findByLemmaInAndLang(distinctTokens, lang);
        if (matched.isEmpty()) return List.of();
        List<Long> wordIds = matched.stream().map(Word::getId).toList();
        Map<Long, List<WordMeaning>> meaningsByWordId = wordMeaningRepository
                .findByWordIdInOrderByDisplayOrderAsc(wordIds).stream()
                .collect(Collectors.groupingBy(m -> m.getWord().getId()));
        Map<String, Word> wordByLemma = matched.stream()
                .collect(Collectors.toMap(Word::getLemma, w -> w, (a, b) -> a));
        return distinctTokens.stream()
                .map(wordByLemma::get)
                .filter(w -> w != null)
                .map(w -> {
                    List<String> wordMeanings = meaningsByWordId.getOrDefault(w.getId(), List.of()).stream()
                            .map(WordMeaning::getMeaningText)
                            .toList();
                    return wordMeanings.isEmpty() ? null : new ExampleWord(w.getLemma(), w.getReading(), wordMeanings);
                })
                .filter(w -> w != null)
                .toList();
    }

    /**
     * 빈칸 채우기 오답 보기를 단어장 밖으로도 넓히기 위한, 헷갈리기 쉬운(발음이 같은 글자로
     * 시작하는) 같은 언어의 다른 단어 표제어들. 부족하면 무작위 단어로 채운다.
     */
    private List<String> similarLemmasFor(Word word) {
        String reading = word.getReading();
        List<Word> byPrefix = (reading != null && !reading.isBlank())
                ? wordRepository.findSimilarByReadingPrefix(word.getLang().name(), reading.substring(0, 1), word.getId(), 3)
                : List.of();
        List<Long> excludeIds = new ArrayList<>();
        excludeIds.add(word.getId());
        byPrefix.forEach(w -> excludeIds.add(w.getId()));
        int remaining = 3 - byPrefix.size();
        List<Word> randomFill = remaining > 0
                ? wordRepository.findRandomWithMeaningByLangExcluding(word.getLang().name(), excludeIds, remaining)
                : List.of();
        List<String> result = new ArrayList<>();
        byPrefix.forEach(w -> result.add(w.getLemma()));
        randomFill.forEach(w -> result.add(w.getLemma()));
        return result;
    }

    /** 토큰(단어/조사 단위) 리스트를 누적 오프셋 기준 WordSpan 리스트로 변환한다. */
    private List<WordSpan> tokensToSpans(List<String> tokens) {
        if (tokens.isEmpty()) return List.of();
        List<WordSpan> spans = new ArrayList<>();
        int offset = 0;
        for (String token : tokens) {
            int start = offset;
            int end = start + token.length();
            spans.add(new WordSpan(start, end));
            offset = end;
        }
        return spans;
    }

    /** 토큰 목록 안에서 표제어(lemma)와 정확히 일치하는 토큰을 찾아 그 구간을 돌려준다. 못 찾으면 null. */
    private int[] locateInTokens(List<String> tokens, String lemma) {
        int offset = 0;
        for (String token : tokens) {
            int end = offset + token.length();
            if (token.equals(lemma)) {
                return new int[]{offset, end};
            }
            offset = end;
        }
        return null;
    }

    /** 토큰화 정보가 없을 때의 폴백 — 예문 텍스트 안에서 표제어를 단순 검색한다. 못 찾으면 null. */
    private int[] locateInText(String text, String lemma) {
        if (text == null || lemma == null) return null;
        int idx = text.indexOf(lemma);
        if (idx < 0) return null;
        return new int[]{idx, idx + lemma.length()};
    }
}
