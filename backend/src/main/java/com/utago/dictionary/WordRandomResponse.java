package com.utago.dictionary;

import com.utago.common.Lang;

import java.util.List;

// 홈 화면 "오늘의 단어" 카드 — 단어장에 있든 없든 상관없이 무작위 단어 하나 + 뜻 + (있으면)
// 실제 가사 예문. exampleText/exampleStart/exampleEnd는 그 단어가 실제로 쓰인 소절 원문과
// 그 안에서 이 단어가 차지하는 구간(다른 사용자의 PRIVATE 곡 가사는 애초에 후보에서 제외됨).
public record WordRandomResponse(
        Long id,
        String lemma,
        Lang lang,
        String reading,
        List<String> meanings,
        String exampleText,
        Integer exampleStart,
        Integer exampleEnd
) {
    public static WordRandomResponse of(Word word, List<WordMeaning> meanings, SongLineWord example) {
        return new WordRandomResponse(
                word.getId(),
                word.getLemma(),
                word.getLang(),
                word.getReading(),
                meanings.stream().map(WordMeaning::getMeaningText).toList(),
                example != null ? example.getSongLine().getOriginalText() : null,
                example != null ? example.getCharOffsetStart() : null,
                example != null ? example.getCharOffsetEnd() : null
        );
    }
}
