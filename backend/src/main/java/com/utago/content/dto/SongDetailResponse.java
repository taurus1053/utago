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
            /** 히라가나 후리가나. 가나로만 된 단어(한자 없음)면 null(후리가나 불필요). */
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
                                return new WordSpanResponse(
                                        w.getCharOffsetStart(),
                                        w.getCharOffsetEnd(),
                                        w.getWord().getLemma(),
                                        w.getWord().getReading(),
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
}
