package com.utago.content;

import com.utago.common.Lang;
import com.utago.content.dto.CreateSongRequest;
import com.utago.content.dto.SongDetailResponse;
import com.utago.content.dto.SongLookupResponse;
import com.utago.content.dto.SongSummaryResponse;
import com.utago.dictionary.SongLineWord;
import com.utago.dictionary.SongLineWordRepository;
import com.utago.dictionary.Word;
import com.utago.dictionary.WordMeaning;
import com.utago.dictionary.WordMeaningEnrichmentService;
import com.utago.dictionary.WordMeaningRepository;
import com.utago.dictionary.WordRepository;
import com.utago.nlp.JapaneseTokenizerService;
import com.utago.user.User;
import com.utago.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    /** 아직 오디오 싱크 편집 도구가 없어서, 곡 등록 시 소절마다 임시로 배정하는 재생 구간 길이. */
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

    /**
     * 공개 카탈로그 검색/목록. PUBLIC + 게시된 곡만 노출한다 — 사용자가 직접 등록한 PRIVATE 곡은
     * 여기 절대 섞이지 않는다(마이페이지 전용 목록은 listMySongs 참고).
     * query가 있으면 제목 검색 우선, 없고 lang만 있으면 언어 필터, 둘 다 없으면 전체 목록.
     */
    public Page<SongSummaryResponse> listSongs(String query, Lang lang, Pageable pageable) {
        Page<Song> page;
        if (query != null && !query.isBlank()) {
            page = songRepository.findByVisibilityAndContentStatusAndTitleContainingIgnoreCase(
                    Visibility.PUBLIC, ContentStatus.PUBLISHED, query, pageable);
        } else if (lang != null) {
            page = songRepository.findByVisibilityAndContentStatusAndSourceLang(
                    Visibility.PUBLIC, ContentStatus.PUBLISHED, lang, pageable);
        } else {
            page = songRepository.findByVisibilityAndContentStatus(
                    Visibility.PUBLIC, ContentStatus.PUBLISHED, pageable);
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
     * (서버가 가사 내용을 생성/보완하지 않음). 소절 타이밍은 실제 오디오 싱크 도구가
     * 생기기 전까지 일정 간격으로 임시 배정한다.
     * 원어가 일본어(JA)면, 형태소 분석으로 후리가나·단어장용 단어 분리를 자동으로 만들어둔다
     * (외부 API 없이 로컬 사전 기반 — 번역과는 별개 파이프라인).
     */
    @Transactional
    public SongDetailResponse createSong(CreateSongRequest request, Long ownerUserId) {
        if (ownerUserId == null) {
            throw new IllegalStateException("로그인이 필요합니다.");
        }
        Song song = Song.builder()
                .title(request.title())
                .artist(request.artist())
                .sourceLang(request.sourceLang())
                .youtubeVideoId(request.youtubeVideoId())
                .audioSourceType(AudioSourceType.YOUTUBE)
                .contentStatus(ContentStatus.PUBLISHED)
                .provenance(Provenance.SELF_TYPED)
                .ownerUserId(ownerUserId)
                .visibility(Visibility.PRIVATE)
                .build();
        song = songRepository.save(song);

        List<SongLine> lines = new ArrayList<>();
        int order = 1;
        int cursorMs = 0;
        for (CreateSongRequest.LineInput lineInput : request.lines()) {
            lines.add(SongLine.builder()
                    .song(song)
                    .lineOrder(order++)
                    .originalText(lineInput.originalText())
                    .translationNatural(lineInput.translationNatural())
                    .startMs(cursorMs)
                    .endMs(cursorMs + DEFAULT_LINE_DURATION_MS)
                    .build());
            cursorMs += DEFAULT_LINE_DURATION_MS;
        }
        lines = songLineRepository.saveAll(lines);

        if (song.getSourceLang() == Lang.JA) {
            analyzeJapaneseLines(lines);
        }

        return SongDetailResponse.from(song, lines, Map.of(), List.of());
    }

    /**
     * 일본어 소절들을 형태소 분석해서 (1) 마스터 사전(Word)에 없는 단어는 새로 등록하고
     * (2) 소절 안 어느 구간이 그 단어인지(SongLineWord)를 저장한다. 같은 단어(lemma)가
     * 여러 줄/여러 곡에 나와도 Word는 재사용된다.
     *
     * 뜻(WordMeaning)은 이번에 등장한 단어 중 아직 뜻이 없는 것만 JMdict+AI 번역으로 채운다
     * (WordMeaningEnrichmentService). JMdict에 없거나 Claude API가 설정 안 돼있으면 그냥
     * 건너뛰고, 프론트에서는 계속 "뜻 준비 중"으로 표시된다 — 정상적인 폴백.
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
                                        .reading(token.furigana())
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
}
