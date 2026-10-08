package com.utago.grammar;

/** /grammar?level= 목록 화면의 카드 한 장. */
public record GrammarEntryResponse(
        Long id,
        GrammarLevel level,
        String pattern,
        String meaning,
        boolean learned
) {
    public static GrammarEntryResponse of(GrammarEntry entry, boolean learned) {
        return new GrammarEntryResponse(entry.getId(), entry.getLevel(), entry.getPattern(), entry.getMeaning(), learned);
    }
}
