package com.utago.content;

import com.utago.common.Lang;
import com.utago.content.dto.CreateSongRequest;
import com.utago.content.dto.SongDetailResponse;
import com.utago.content.dto.SongLookupResponse;
import com.utago.content.dto.SongSummaryResponse;
import com.utago.content.dto.UpdateLinesRequest;
import com.utago.content.dto.UpdateSyncRequest;
import com.utago.dictionary.SongLineWord;
import com.utago.dictionary.SongLineWordRepository;
import com.utago.dictionary.Word;
import com.utago.dictionary.WordMeaning;
import com.utago.dictionary.WordExampleService;
import com.utago.dictionary.WordMeaningEnrichmentService;
import com.utago.dictionary.WordMeaningRepository;
import com.utago.dictionary.WordRepository;
import com.utago.nlp.JapaneseTokenizerService;
import com.utago.user.LearningStatsService;
import com.utago.user.Role;
import com.utago.user.User;
import com.utago.user.UserRepository;
import com.utago.wordbook.UserSongProgress;
import com.utago.wordbook.UserSongProgressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
public class SongService {

    /** 아직 오디오 싱크 편집 도구가 없어서, 곡 등록 시 소절마다 임시로 배정하는 재생 구간 길이.
     * 관리자가 미리 맞춰둔 싱크(SongSyncCache)가 있는 소절은 이 값 대신 그걸 그대로 쓴다. */
    private static final int DEFAULT_LINE_DURATION_MS = 4000;

    private final SongRepository songRepository;
    private final SongLineRepository songLineRepository;
    private final SongLineReadingRepository songLineReadingRepository;
    private final GrammarPointRepository grammarPointRepository;
    private final UserRepository userRepository;
    private final YoutubeOEmbedClient youtubeOEmbedClient;
    private final JapaneseTokenizerService japaneseTokenizerService;
    private final WordRepository wordRepository;
    private final WordMeaningRepository wordMeaningRepository;
    private final SongLineWordRepository songLineWordRepository;
    private final WordMeaningEnrichmentService wordMeaningEnrichmentService;
    private final WordExampleService wordExampleService;
    private final SongSyncCacheService songSyncCacheService;
    private final SongLineReadingService songLineReadingService;
    private final UserSongProgressRepository userSongProgressRepository;
    private final LearningStatsService learningStatsService;

    /**
     * 공개 카탈로그 검색/목록 — "전체 곡" 섹션. PUBLIC + 게시 + AI_GENERATED(관리자가 만든
     * AI 학습곡)만 노출한다 — 사용자가 직접 등록한 PRIVATE 곡은 여기 절대 섞이지 않는다
     * (마이페이지 전용 목록은 listMySongs 참고).
     *
     * 원래는 "PUBLIC + 게시"만 보면 됐는데(저작권 해결된 곡을 운영진이 승격), 당분간 그 승격
     * 기능은 쓰지 않기로 하고 대신 관리자가 직접 만든 AI 학습곡(createAiLearningSong)으로
     * "전체 곡" 섹션을 대체한다 — provenance=AI_GENERATED 조건을 추가한 이유.
     *
     * query가 있으면 제목 검색 우선, 없고 lang만 있으면 언어 필터, 둘 다 없으면 전체 목록.
     */
    public Page<SongSummaryResponse> listSongs(String query, Lang lang, Pageable pageable) {
        Page<Song> page;
        if (query != null && !query.isBlank()) {
            page = songRepository.findByVisibilityAndContentStatusAndProvenanceAndTitleContainingIgnoreCase(
                    Visibility.PUBLIC, ContentStatus.PUBLISHED, Provenance.AI_GENERATED, query, pageable);
        } else if (lang != null) {
            page = songRepository.findByVisibilityAndContentStatusAndProvenanceAndSourceLang(
                    Visibility.PUBLIC, ContentStatus.PUBLISHED, Provenance.AI_GENERATED, lang, pageable);
        } else {
            page = songRepository.findByVisibilityAndContentStatusAndProvenance(
                    Visibility.PUBLIC, ContentStatus.PUBLISHED, Provenance.AI_GENERATED, pageable);
        }
        return page.map(SongSummaryResponse::from);
    }

    /**
     * 마이페이지 - 내가 등록한 곡 목록. 로그인한 본인 것만 내려준다(로그인 필수, 컨트롤러/보안설정에서 강제).
     */
    public Page<SongSummaryResponse> listMySongs(Long userId, Pageable pageable) {
        return songRepository.findByOwnerUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(SongSummaryResponse::from);
    }

    /**
     * 곡 학습 화면 — 소절 전체(원문/의역/발음 표기), 단어 단위 분석(후리가나/뜻 팝업), 문법 포인트.
     * PUBLIC 게시 곡은 누구나 볼 수 있고, PRIVATE 곡은 등록한 본인만 볼 수 있다.
     * userId가 있으면 그 사용자의 모국어 기준으로 발음 표기를 내려준다.
     */
    public SongDetailResponse getSongDetail(Long songId, Long userId) {
        Song song = songRepository.findById(songId)
                .filter(s -> isViewable(s, userId))
                .orElseThrow(() -> new IllegalStateException("곡을 찾을 수 없습니다."));

        List<SongLine> lines = songLineRepository.findBySongIdOrderByLineOrderAsc(songId);
        List<Long> lineIds = lines.stream().map(SongLine::getId).toList();

        Lang readingLang = resolveReadingLang(userId, song.getSourceLang());
        Map<Long, String> readingByLineId = lineIds.isEmpty()
                ? Map.of()
                : songLineReadingRepository.findBySongLineIdInAndTargetLang(lineIds, readingLang).stream()
                        .collect(Collectors.toMap(r -> r.getSongLine().getId(), r -> r.getReadingText()));

        List<GrammarPoint> grammarPoints = grammarPointRepository.findBySongId(songId);

        Map<Long, List<SongLineWord>> wordsByLineId = Map.of();
        Map<Long, List<WordMeaning>> meaningsByWordId = Map.of();
        if (!lineIds.isEmpty()) {
            List<SongLineWord> allWords = songLineWordRepository.findBySongLineIdIn(lineIds);
            wordsByLineId = allWords.stream()
                    .collect(Collectors.groupingBy(w -> w.getSongLine().getId()));
            List<Long> wordIds = allWords.stream().map(w -> w.getWord().getId()).distinct().toList();
            if (!wordIds.isEmpty()) {
                meaningsByWordId = wordMeaningRepository.findByWordIdInOrderByDisplayOrderAsc(wordIds).stream()
                        .collect(Collectors.groupingBy(m -> m.getWord().getId()));
            }
        }

        return SongDetailResponse.from(song, lines, readingByLineId, grammarPoints, wordsByLineId, meaningsByWordId);
    }

    private boolean isViewable(Song song, Long userId) {
        if (song.getVisibility() == Visibility.PUBLIC) {
            return song.getContentStatus() == ContentStatus.PUBLISHED;
        }
        // PRIVATE: 등록한 본인만.
        return userId != null && userId.equals(song.getOwnerUserId());
    }

    /**
     * 곡 등록. 반드시 로그인한 사용자만 호출할 수 있고(컨트롤러에서 인증 확인), 등록한 곡은
     * 항상 그 사용자 본인 소유의 PRIVATE 곡으로 저장된다 — 다른 사용자에게는 보이지 않는다.
     * 가사 원문/번역은 요청한 사용자가 직접 입력한 텍스트를 그대로 저장한다
     * (서버가 가사 내용을 생성/보완하지 않음).
     *
     * 소절 타이밍: 같은 유튜브 영상으로 관리자가 이미 탭싱크를 맞춰둔 적이 있으면
     * (SongSyncCache) 그 타이밍을 그대로 재사용하고, 캐시에 없는 소절만 일정 간격으로
     * 임시 배정한다 — line_translation_cache와 같은 "관리자가 한 번 맞춰두면 모두가
     * 재사용" 구조.
     * 원어가 일본어(JA)면, 형태소 분석으로 후리가나·단어장용 단어 분리와 함께 한국어
     * 발음 표기(SongLineReading)도 자동으로 만들어둔다(외부 API 없이 로컬 사전+규칙
     * 기반 — 번역과는 별개 파이프라인).
     */
    @Transactional
    public SongDetailResponse createSong(CreateSongRequest request, Long ownerUserId) {
        if (ownerUserId == null) {
            throw new IllegalStateException("로그인이 필요합니다.");
        }
        return buildAndSaveSong(request, ownerUserId, Visibility.PRIVATE, Provenance.SELF_TYPED);
    }

    /**
     * 관리자 전용 — AI로 만든 "학습곡"(멜로디·보컬·가사를 AI로 제작한 뒤 관리자가 유튜브에
     * 올려 가져온 곡)을 공개 카탈로그에 바로 등록한다. 일반 등록(createSong)과 달리 PRIVATE가
     * 아니라 처음부터 PUBLIC으로 저장되어 "전체 곡" 섹션(listSongs)에 즉시 노출된다.
     * 호출 권한(ADMIN 여부)은 컨트롤러(AdminSongController)가 매 요청마다 확인한다.
     * 소유자는 특정 사용자 개인이 아니라 카탈로그 자체이므로 ownerUserId는 null로 둔다.
     */
    @Transactional
    public SongDetailResponse createAiLearningSong(CreateSongRequest request) {
        return buildAndSaveSong(request, null, Visibility.PUBLIC, Provenance.AI_GENERATED);
    }

    private SongDetailResponse buildAndSaveSong(
            CreateSongRequest request, Long ownerUserId, Visibility visibility, Provenance provenance
    ) {
        Song song = Song.builder()
                .title(request.title())
                .artist(request.artist())
                .sourceLang(request.sourceLang())
                .youtubeVideoId(request.youtubeVideoId())
                .audioSourceType(AudioSourceType.YOUTUBE)
                .contentStatus(ContentStatus.PUBLISHED)
                .provenance(provenance)
                .ownerUserId(ownerUserId)
                .visibility(visibility)
                .build();
        song = songRepository.save(song);

        Map<Integer, SongSyncCache> cachedTimings = songSyncCacheService.lookupByVideoId(song.getYoutubeVideoId());

        List<SongLine> lines = new ArrayList<>();
        int order = 1;
        int cursorMs = 0;
        for (CreateSongRequest.LineInput lineInput : request.lines()) {
            SongSyncCache cached = cachedTimings.get(order);
            int startMs;
            int endMs;
            if (cached != null) {
                startMs = cached.getStartMs();
                endMs = cached.getEndMs();
            } else {
                startMs = cursorMs;
                endMs = cursorMs + DEFAULT_LINE_DURATION_MS;
            }
            lines.add(SongLine.builder()
                    .song(song)
                    .lineOrder(order++)
                    .originalText(lineInput.originalText())
                    .translationNatural(lineInput.translationNatural())
                    .startMs(startMs)
                    .endMs(endMs)
                    .build());
            cursorMs += DEFAULT_LINE_DURATION_MS;
        }
        lines = songLineRepository.saveAll(lines);

        if (song.getSourceLang() == Lang.JA) {
            analyzeJapaneseLines(lines);
            songLineReadingService.generateKoReadings(lines);
        }

        return SongDetailResponse.from(song, lines, Map.of(), List.of());
    }

    /**
     * 소절 타이밍(가사 싱크) 저장/수정. 곡을 등록한 본인만 호출할 수 있다.
     * 요청한 사용자가 ADMIN이면, 이 타이밍을 SongSyncCache에도 함께 반영해서 같은 유튜브
     * 영상으로 곡을 등록하는 다른 모든 사용자가 이후 그대로 재사용할 수 있게 한다 — 일반
     * 사용자가 자기 곡 타이밍을 고치는 건 본인 곡에만 반영되고 공유 캐시는 건드리지 않는다.
     */
    @Transactional
    public SongDetailResponse updateLineTimings(Long songId, Long userId, List<UpdateSyncRequest.LineTiming> timings) {
        Song song = songRepository.findById(songId)
                .orElseThrow(() -> new IllegalStateException("곡을 찾을 수 없습니다."));
        if (userId == null || !userId.equals(song.getOwnerUserId())) {
            throw new IllegalStateException("본인이 등록한 곡만 싱크를 수정할 수 있습니다.");
        }

        Map<Long, SongLine> lineById = songLineRepository.findBySongIdOrderByLineOrderAsc(songId).stream()
                .collect(Collectors.toMap(SongLine::getId, l -> l));
        for (UpdateSyncRequest.LineTiming t : timings) {
            SongLine line = lineById.get(t.lineId());
            if (line == null) continue;
            line.setStartMs(t.startMs());
            line.setEndMs(t.endMs());
        }
        List<SongLine> saved = songLineRepository.saveAll(lineById.values());
        saved.sort((a, b) -> Integer.compare(a.getLineOrder(), b.getLineOrder()));

        boolean isAdmin = userRepository.findById(userId).map(u -> u.getRole() == Role.ADMIN).orElse(false);
        if (isAdmin) {
            songSyncCacheService.upsertAdminBatch(song.getYoutubeVideoId(), saved);
        }

        return getSongDetail(songId, userId);
    }

    /**
     * 가사 내용(원문/의역) 수정 — 등록할 때 오탈자를 냈거나 나중에 잘못된 걸 발견했을 때
     * 고칠 수 있게. 곡을 등록한 본인만 호출할 수 있다(타이밍 수정과 동일한 권한 체크).
     *
     * 원문(originalText)이 실제로 바뀐 소절은, 그 소절에 딸려 있던 예전 분석 결과(단어장
     * 연결 SongLineWord, 발음 표기 SongLineReading)가 더 이상 맞지 않으므로 지우고
     * 다시 만든다 — createSong 때와 같은 파이프라인(analyzeJapaneseLines +
     * SongLineReadingService)을 그 소절들만 대상으로 재실행. 의역만 고친 경우는
     * 재분석이 필요 없어서 건드리지 않는다.
     */
    @Transactional
    public SongDetailResponse updateLineContent(Long songId, Long userId, List<UpdateLinesRequest.LineEdit> edits) {
        Song song = songRepository.findById(songId)
                .orElseThrow(() -> new IllegalStateException("곡을 찾을 수 없습니다."));
        if (userId == null || !userId.equals(song.getOwnerUserId())) {
            throw new IllegalStateException("본인이 등록한 곡만 가사를 수정할 수 있습니다.");
        }

        Map<Long, SongLine> lineById = songLineRepository.findBySongIdOrderByLineOrderAsc(songId).stream()
                .collect(Collectors.toMap(SongLine::getId, l -> l));

        List<SongLine> toSave = new ArrayList<>();
        List<SongLine> textChangedLines = new ArrayList<>();
        for (UpdateLinesRequest.LineEdit edit : edits) {
            if (edit == null || edit.lineId() == null) continue;
            SongLine line = lineById.get(edit.lineId());
            if (line == null) continue;

            boolean textChanged = edit.originalText() != null && !edit.originalText().equals(line.getOriginalText());
            if (edit.originalText() != null) {
                line.setOriginalText(edit.originalText());
            }
            if (edit.translationNatural() != null) {
                line.setTranslationNatural(edit.translationNatural());
            }
            toSave.add(line);
            if (textChanged) {
                textChangedLines.add(line);
            }
        }
        songLineRepository.saveAll(toSave);

        if (!textChangedLines.isEmpty()) {
            List<Long> changedIds = textChangedLines.stream().map(SongLine::getId).toList();
            songLineWordRepository.deleteAll(songLineWordRepository.findBySongLineIdIn(changedIds));
            songLineReadingRepository.deleteAll(songLineReadingRepository.findBySongLineIdIn(changedIds));

            if (song.getSourceLang() == Lang.JA) {
                analyzeJapaneseLines(textChangedLines);
                songLineReadingService.generateKoReadings(textChangedLines);
            }
        }

        return getSongDetail(songId, userId);
    }

    /**
     * 일본어 소절들을 형태소 분석해서 (1) 마스터 사전(Word)에 없는 단어는 새로 등록하고
     * (2) 소절 안 어느 구간이 그 단어인지(SongLineWord)를 저장한다. 같은 단어(lemma)가
     * 여러 줄/여러 곡에 나와도 Word는 재사용된다.
     *
     * 뜻(WordMeaning)은 이번에 등장한 단어 중 아직 뜻이 없는 것만 JMdict+AI 번역으로 채운다
     * (WordMeaningEnrichmentService). JMdict에 없거나 Claude API가 설정 안 돼있으면 그냥
     * 건너뛰고, 프론트에서는 계속 "뜻 준비 중"으로 표시된다 — 정상적인 폴백.
     *
     * 예문(WordExample)도 마찬가지로, 이번에 등장한 단어 중 예문이 하나도 없는 것만 AI로
     * 만들어 저장한다(WordExampleService.getOrGenerateExamples) — 이미 예문이 있는 단어는
     * 다시 만들지 않는다. 실패/미설정이면 그냥 건너뛰고 나중에(단어장 조회 시 또는 서버
     * 재시작 백필로) 채워질 수 있다.
     */
    private void analyzeJapaneseLines(List<SongLine> lines) {
        Map<String, Word> wordCache = new HashMap<>();
        List<SongLineWord> toSave = new ArrayList<>();

        for (SongLine line : lines) {
            for (JapaneseTokenizerService.TokenSpan token : japaneseTokenizerService.tokenize(line.getOriginalText())) {
                if (!token.vocabWorthy()) {
                    continue;
                }
                Word word = wordCache.computeIfAbsent(token.baseForm(), lemma ->
                        wordRepository.findByLemmaAndLang(lemma, Lang.JA)
                                .orElseGet(() -> wordRepository.save(Word.builder()
                                        .lemma(lemma)
                                        .lang(Lang.JA)
                                        .reading(token.lemmaReading() != null ? token.lemmaReading() : token.furigana())
                                        .pos(token.partOfSpeech())
                                        .dictSource("kuromoji-ipadic")
                                        .build()))
                );
                toSave.add(SongLineWord.builder()
                        .songLine(line)
                        .word(word)
                        .charOffsetStart(token.charOffsetStart())
                        .charOffsetEnd(token.charOffsetEnd())
                        .build());
            }
        }
        songLineWordRepository.saveAll(toSave);

        List<Word> distinctWords = new ArrayList<>(wordCache.values());
        List<Long> wordIds = distinctWords.stream().map(Word::getId).toList();
        if (!wordIds.isEmpty()) {
            java.util.Set<Long> haveMeaning = wordMeaningRepository.findByWordIdInOrderByDisplayOrderAsc(wordIds).stream()
                    .map(m -> m.getWord().getId())
                    .collect(Collectors.toSet());
            List<Word> needMeaning = distinctWords.stream()
                    .filter(w -> !haveMeaning.contains(w.getId()))
                    .toList();
            wordMeaningEnrichmentService.enrich(needMeaning);

            wordExampleService.getOrGenerateExamples(distinctWords);
        }
    }

    /**
     * 곡 추가 화면에서 유튜브 링크를 붙여넣었을 때 호출.
     * 가사를 만들어주지 않는다 — 이미 등록된 곡(공개 카탈로그, 또는 나만의 PRIVATE 곡)이면 그
     * 곡으로 안내하고, 없으면 유튜브 공개 메타데이터(영상 제목/채널명)만으로 제목/아티스트를
     * 추측해서 입력칸에 미리 채워주는 것까지만 한다. 다른 사용자의 PRIVATE 곡은 매칭 대상에서
     * 제외된다 — 존재 여부조차 알려주지 않는다.
     */
    public SongLookupResponse lookupByYoutube(String videoId, Long userId) {
        Optional<Song> byPublic = songRepository.findFirstByYoutubeVideoIdAndVisibilityAndContentStatus(
                videoId, Visibility.PUBLIC, ContentStatus.PUBLISHED);
        if (byPublic.isPresent()) {
            return SongLookupResponse.existing(byPublic.get().getId());
        }
        if (userId != null) {
            Optional<Song> byMine = songRepository.findFirstByYoutubeVideoIdAndOwnerUserId(videoId, userId);
            if (byMine.isPresent()) {
                return SongLookupResponse.existing(byMine.get().getId());
            }
        }

        Optional<YoutubeOEmbedClient.VideoMeta> meta = youtubeOEmbedClient.fetch(videoId);
        if (meta.isEmpty()) {
            return SongLookupResponse.suggestion(null, null, null, null);
        }

        String[] guess = guessTitleArtist(meta.get().title(), meta.get().authorName());
        String guessedTitle = guess[0];
        String guessedArtist = guess[1];

        if (guessedArtist != null && !guessedArtist.isBlank()) {
            Optional<Song> byTitleArtist = songRepository
                    .findByVisibilityAndContentStatusAndTitleIgnoreCaseAndArtistIgnoreCase(
                            Visibility.PUBLIC, ContentStatus.PUBLISHED, guessedTitle, guessedArtist);
            if (byTitleArtist.isPresent()) {
                return SongLookupResponse.existing(byTitleArtist.get().getId());
            }
        }

        return SongLookupResponse.suggestion(guessedTitle, guessedArtist, meta.get().title(), meta.get().authorName());
    }

    /**
     * 유튜브 영상 제목/채널명에서 곡 제목·아티스트를 추측하는 아주 단순한 휴리스틱.
     * "아티스트 - 제목", "제목 / 아티스트" 같은 흔한 패턴만 처리하고, 못 알아내면
     * 영상 제목 전체를 곡 제목으로, 채널명을 아티스트로 그냥 쓴다 — 어차피 사용자가
     * 등록 화면에서 눈으로 보고 고칠 수 있으니 완벽할 필요는 없다.
     */
    private String[] guessTitleArtist(String youtubeTitle, String channelName) {
        String title = youtubeTitle;
        String artist = channelName;

        int slashIdx = title.indexOf(" / ");
        if (slashIdx > 0) {
            String left = title.substring(0, slashIdx).trim();
            String right = title.substring(slashIdx + 3).split("[:：]")[0].trim();
            if (!left.isBlank() && !right.isBlank()) {
                return new String[] { left, right };
            }
        }

        int dashIdx = title.indexOf(" - ");
        if (dashIdx > 0) {
            String left = title.substring(0, dashIdx).trim();
            String right = title.substring(dashIdx + 3).trim();
            if (!left.isBlank() && !right.isBlank()) {
                // 유튜브 관례상 "아티스트 - 제목" 순서가 흔함
                return new String[] { right, left };
            }
        }

        if (artist != null) {
            artist = artist.replaceAll("(?i)\\s*-\\s*Topic$", "")
                    .replaceAll("(?i)\\s*Official.*$", "")
                    .trim();
        }
        return new String[] { title, artist };
    }

    private Lang resolveReadingLang(Long userId, Lang sourceLang) {
        if (userId != null) {
            Lang nativeLang = userRepository.findById(userId).map(User::getNativeLang).orElse(null);
            if (nativeLang != null && nativeLang != sourceLang) {
                return nativeLang;
            }
        }
        return sourceLang == Lang.KO ? Lang.EN : Lang.KO;
    }

    /**
     * 관리자 "추천곡 관리" 화면 — 제목/아티스트로 곡 검색(공개 범위 무관, 추천곡으로 지정할
     * 곡을 찾기 위한 용도라 전체 곡 대상). 검색어가 비어있으면 빈 목록을 돌려준다(전체 곡을
     * 다 펼쳐 보여주면 관리 화면이 감당하기 어려워서 — 검색어로 좁혀서 찾게 한다).
     */
    public List<AdminSongSummaryResponse> searchSongsForAdmin(String query) {
        if (query == null || query.isBlank()) return List.of();
        return songRepository.findTop20ByTitleContainingIgnoreCaseOrArtistContainingIgnoreCase(query, query)
                .stream().map(AdminSongSummaryResponse::from).toList();
    }

    /** 관리자 "추천곡 관리" 화면 — 현재 추천곡으로 지정된 곡 전체 목록(제목순). */
    public List<AdminSongSummaryResponse> listFeaturedSongs() {
        return songRepository.findByFeaturedTrueOrderByTitleAsc()
                .stream().map(AdminSongSummaryResponse::from).toList();
    }

    /**
     * 관리자 "추천곡 관리" 화면 — 곡 하나를 오늘의 추천곡 후보로 켜거나 끈다. 유튜브 영상이
     * 없는 곡을 켜려고 하면 막는다(오늘의 추천곡 카드는 썸네일이 필수라 어차피 후보에서
     * 제외되므로, 관리자가 "켰는데 왜 안 나오지" 헷갈리지 않도록 미리 막아준다).
     */
    @Transactional
    public AdminSongSummaryResponse setFeatured(Long songId, boolean featured) {
        Song song = songRepository.findById(songId)
                .orElseThrow(() -> new IllegalStateException("곡을 찾을 수 없습니다."));
        if (featured && (song.getYoutubeVideoId() == null || song.getYoutubeVideoId().isBlank())) {
            throw new IllegalStateException("유튜브 영상이 연결된 곡만 추천곡으로 지정할 수 있습니다.");
        }
        song.setFeatured(featured);
        return AdminSongSummaryResponse.from(song);
    }

    /**
     * "한 줄씩 보기"에서 소절을 넘길 때마다 호출 — 이어 학습 지점(lastLineOrder)을 갱신하고,
     * 마이페이지 학습 통계(완료한 가사/곡)·스트릭의 원천 데이터가 된다(claude/소셜_마이페이지_기획.md
     * 10번). 뒤로 가는 탐색도 있을 수 있어 항상 "가장 멀리 간 지점"만 저장한다(최댓값).
     *
     * 2026-10-08 추가 — 칭호 "같은 곡 복습"(completedCount)도 여기서 같이 집계한다. "복습 1회"는
     * 사용자가 확정한 기준대로 "가사를 끝까지 다시 완주할 때마다"다: 마지막 줄에 도달하면
     * +1(completedThisPass로 중복 집계 방지), 처음(0번 줄)으로 돌아가면 다음 완주를 다시 셀 수
     * 있도록 풀어준다.
     */
    @Transactional
    public void updateSongProgress(Long userId, Long songId, int lineOrder) {
        if (lineOrder < 0) return;
        UserSongProgress progress = userSongProgressRepository.findByUserIdAndSongId(userId, songId)
                .orElseGet(() -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
                    Song song = songRepository.findById(songId)
                            .orElseThrow(() -> new IllegalStateException("곡을 찾을 수 없습니다."));
                    return UserSongProgress.builder().user(user).song(song).lastLineOrder(0).build();
                });
        if (lineOrder > progress.getLastLineOrder()) {
            progress.setLastLineOrder(lineOrder);
        }
        progress.setLastStudiedAt(LocalDateTime.now());

        int totalLines = songLineRepository.countBySongId(songId);
        if (lineOrder == 0 && progress.isCompletedThisPass()) {
            // 처음으로 돌아가서 다시 듣기 시작 — 다음 완주를 새로 셀 수 있게 플래그를 푼다.
            progress.setCompletedThisPass(false);
        } else if (totalLines > 0 && lineOrder >= totalLines - 1 && !progress.isCompletedThisPass()) {
            progress.setCompletedCount(progress.getCompletedCount() + 1);
            progress.setCompletedThisPass(true);
        }

        userSongProgressRepository.save(progress);
        learningStatsService.recordActivity(userId);
    }
}
