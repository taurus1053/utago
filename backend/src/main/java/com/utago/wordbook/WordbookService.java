package com.utago.wordbook;

import com.utago.common.Lang;
import com.utago.dictionary.SongLineWord;
import com.utago.dictionary.SongLineWordRepository;
import com.utago.dictionary.Word;
import com.utago.dictionary.WordExample;
import com.utago.dictionary.WordExampleService;
import com.utago.dictionary.WordMeaning;
import com.utago.dictionary.WordMeaningRepository;
import com.utago.dictionary.WordRepository;
import com.utago.user.User;
import com.utago.user.UserRepository;
import lombok.RequiredArgsConstructor;
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
    public WordbookResponse createWordbook(Long userId, String name, Long folderId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
        WordbookFolder folder = folderId != null ? requireOwnedFolder(userId, folderId) : null;
        Wordbook saved = wordbookRepository.save(Wordbook.builder()
                .user(user)
                .name(name)
                .folder(folder)
                .favoriteDefault(false)
                .build());
        return WordbookResponse.of(saved, 0);
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

    @Transactional
    public void removeItem(Long userId, Long itemId) {
        WordbookItem item = requireOwnedItem(userId, itemId);
        wordbookItemRepository.delete(item);
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
     */
    @Transactional
    public WordbookItemResponse review(Long userId, Long itemId, boolean know) {
        WordbookItem item = requireOwnedItem(userId, itemId);
        if (know) {
            int nextCount = item.getRepetitionCount() + 1;
            item.setRepetitionCount(nextCount);
            int idx = Math.min(nextCount - 1, REVIEW_INTERVALS_DAYS.length - 1);
            int intervalDays = REVIEW_INTERVALS_DAYS[idx];
            item.setIntervalDays(intervalDays);
            item.setNextReviewAt(LocalDateTime.now().plusDays(intervalDays));
            item.setStatus(nextCount >= REVIEW_INTERVALS_DAYS.length
                    ? WordbookItemStatus.MASTERED
                    : WordbookItemStatus.LEARNING);
        } else {
            item.setRepetitionCount(0);
            item.setIntervalDays(1);
            item.setNextReviewAt(LocalDateTime.now());
            item.setStatus(WordbookItemStatus.LEARNING);
        }
        return toResponses(userId, List.of(item)).get(0);
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

    private List<WordbookItemResponse> toResponses(Long userId, List<WordbookItem> items) {
        if (items.isEmpty()) return List.of();
        List<Long> wordIds = items.stream().map(i -> i.getWord().getId()).distinct().toList();
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
        Map<Long, WordExample> aiExampleByWordId = wordExampleService.getOrGenerateExamples(wordsMissingLyricExample);

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
                                meanings,
                                aiExample.getExampleText(),
                                ownSpan == null ? null : ownSpan[0],
                                ownSpan == null ? null : ownSpan[1],
                                aiExample.getExampleTranslation(),
                                spans,
                                exampleWordsForAi(tokens, item.getWord().getLang()),
                                similarLemmas);
                    }

                    return WordbookItemResponse.of(item, meanings, null, null, null, null, List.of(), List.of(), similarLemmas);
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
