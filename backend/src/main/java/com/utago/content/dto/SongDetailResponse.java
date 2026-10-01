package com.utago.content.dto;

import com.utago.common.Lang;
import com.utago.content.GrammarPoint;
import com.utago.content.Song;
import com.utago.content.SongLine;
import com.utago.dictionary.SongLineWord;
import com.utago.dictionary.WordMeaning;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

public record SongDetailResponse(
        Long id, String title, String artist, Lang sourceLang, String youtubeVideoId,
        List<LineResponse> lines, List<GrammarPointResponse> grammarPoints
) {
    public record LineResponse(
            Long id, int lineOrder, String originalText, String translationNatural,
            String reading, int startMs, int endMs,
            /** 소절 안의 단어 단위 분리 — 후리가나(furigana)와 단어 탭 팝업(뜻)에 쓰인다.
             *  일본어 곡이 아니거나 아직 분석되지 않은 곡은 빈 리스트. */
            List<WordSpanResponse> words
    ) {}

    /** 소절 원문 안의 한 구간(char offset) = 형태소 분석으로 뽑아낸 단어 하나. */
    public record WordSpanResponse(
            int charOffsetStart, int charOffsetEnd,
            String lemma,
            /** 히라가나 후리가나. 이 구간의 실제 표면형(surface)이 한자를 하나도 포함하지
             *  않으면 항상 null(후리가나 불필요) — 아래 deriveFurigana() 참고. */
            String furigana,
            /** 사전에 뜻이 아직 없으면 빈 리스트 — 프론트에서 "사전 준비 중"처럼 표시하면 됨. */
            List<String> meanings
    ) {}

    public record GrammarPointResponse(Long id, String pattern, String explanation, Long exampleLineId) {}

    public static SongDetailResponse from(
            Song song,
            List<SongLine> lines,
            Map<Long, String> readingBySongLineId,
            List<GrammarPoint> grammarPoints
    ) {
        return from(song, lines, readingBySongLineId, grammarPoints, Map.of(), Map.of());
    }

    public static SongDetailResponse from(
            Song song,
            List<SongLine> lines,
            Map<Long, String> readingBySongLineId,
            List<GrammarPoint> grammarPoints,
            Map<Long, List<SongLineWord>> wordsBySongLineId,
            Map<Long, List<WordMeaning>> meaningsByWordId
    ) {
        List<LineResponse> lineResponses = lines.stream()
                .map(line -> {
                    List<SongLineWord> words = wordsBySongLineId.getOrDefault(line.getId(), List.of());
                    List<WordSpanResponse> wordSpans = words.stream()
                            .sorted(Comparator.comparingInt(SongLineWord::getCharOffsetStart))
                            .map(w -> {
                                List<String> meanings = meaningsByWordId
                                        .getOrDefault(w.getWord().getId(), List.of())
                                        .stream()
                                        .map(WordMeaning::getMeaningText)
                                        .toList();
                                String surface = line.getOriginalText()
                                        .substring(w.getCharOffsetStart(), w.getCharOffsetEnd());
                                String furigana = deriveFurigana(
                                        surface, w.getWord().getLemma(), w.getWord().getReading());
                                return new WordSpanResponse(
                                        w.getCharOffsetStart(),
                                        w.getCharOffsetEnd(),
                                        w.getWord().getLemma(),
                                        furigana,
                                        meanings
                                );
                            })
                            .toList();
                    return new LineResponse(
                            line.getId(),
                            line.getLineOrder(),
                            line.getOriginalText(),
                            line.getTranslationNatural(),
                            readingBySongLineId.get(line.getId()),
                            line.getStartMs(),
                            line.getEndMs(),
                            wordSpans
                    );
                })
                .toList();

        List<GrammarPointResponse> grammarResponses = grammarPoints.stream()
                .map(gp -> new GrammarPointResponse(
                        gp.getId(),
                        gp.getPattern(),
                        gp.getExplanation(),
                        gp.getExampleSongLine() != null ? gp.getExampleSongLine().getId() : null
                ))
                .toList();

        return new SongDetailResponse(
                song.getId(),
                song.getTitle(),
                song.getArtist(),
                song.getSourceLang(),
                song.getYoutubeVideoId(),
                lineResponses,
                grammarResponses
        );
    }

    /**
     * 이 단어가 실제로 쓰인 표면형(surface)에 맞는 후리가나를 돌려준다.
     *
     * Word.reading은 항상 "사전형(lemma) 그 자체의 읽기"로 저장돼 있다
     * (JapaneseTokenizerService.readingForLemma 참고). 그런데 가사 속에서는 활용된
     * 형태(surface)로 등장하는 경우가 훨씬 많아서(예: 사전형 悪い → 가사 속 悪く),
     * Word.reading을 그대로 갖다 쓰면 어미가 틀린 후리가나가 나온다("わるい"가 아니라
     * "わるく"가 맞다). 일본어 활용은 항상 꼬리(오쿠리가나)만 가나로 바뀌고 어간(한자
     * 부분)은 그대로이므로, surface/lemma의 공통 접두 길이만큼은 읽기의 앞부분을 그대로
     * 쓰고 나머지는 surface 자신의 꼬리(이미 가나이므로 그 자체가 읽기)로 바꿔치기한다.
     *
     * 안전장치(이 메서드가 있는 진짜 이유) — surface 자체가 한자를 전혀 포함하지 않으면
     * 애초에 후리가나가 필요 없으므로 항상 null을 돌려준다. Word.reading/lemma가 무엇이든
     * (예: 형태소 분석이 구어체 축약형을 엉뚱한 한자 단어로 오인식해서 lemma가 완전히
     * 다른 단어가 됐더라도) 이미 가나로만 적힌 글자 위에 엉뚱한 후리가나가 뜨는 사고를
     * 이 한 군데에서 원천 차단한다 — SongLineWord는 charOffset만 저장하고 당시의 분석
     * 결과(hasKanji 등)를 따로 들고 있지 않으므로, 응답을 만드는 시점에 항상 다시
     * 확인해야 한다.
     */
    private static String deriveFurigana(String surface, String lemma, String lemmaReading) {
        if (surface == null || !containsKanji(surface)) {
            return null;
        }
        if (lemma == null || lemmaReading == null || lemmaReading.isBlank()) {
            return null;
        }
        if (surface.equals(lemma)) {
            return lemmaReading;
        }
        int commonLen = 0;
        int maxCommon = Math.min(surface.length(), lemma.length());
        while (commonLen < maxCommon && surface.charAt(commonLen) == lemma.charAt(commonLen)) {
            commonLen++;
        }
        String surfaceTail = surface.substring(commonLen);
        String lemmaTail = lemma.substring(commonLen);
        if (lemmaReading.length() < lemmaTail.length()) {
            // 안전하게 계산할 수 없으면(불규칙 활용 등) 틀린 후리가나를 보여주느니 생략한다.
            return null;
        }
        String stemReading = lemmaReading.substring(0, lemmaReading.length() - lemmaTail.length());
        return stemReading + surfaceTail;
    }

    private static boolean containsKanji(String s) {
        return s.codePoints().anyMatch(cp -> cp >= 0x4E00 && cp <= 0x9FFF);
    }
}
