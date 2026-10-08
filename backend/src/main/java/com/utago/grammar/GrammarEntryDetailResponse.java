package com.utago.grammar;

import java.util.List;

public record GrammarEntryDetailResponse(
        Long id,
        GrammarLevel level,
        String pattern,
        String meaning,
        String explanation,
        String structure,
        String exampleSentence,
        String exampleTranslation,
        boolean learned,
        List<GrammarSongRef> songs
) {
    public static GrammarEntryDetailResponse of(GrammarEntry e, boolean learned, List<GrammarSongRef> songs) {
        return new GrammarEntryDetailResponse(
                e.getId(), e.getLevel(), e.getPattern(), e.getMeaning(), e.getExplanation(),
                e.getStructure(), e.getExampleSentence(), e.getExampleTranslation(), learned, songs
        );
    }
}
