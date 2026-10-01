package com.utago.wordbook;

import com.utago.common.Lang;
import com.utago.dictionary.Word;
import com.utago.dictionary.WordMeaning;

import java.time.LocalDateTime;
import java.util.List;

// 단어장 상세(단어 목록/플래시카드/미니게임) 화면에서 단어 하나를 나타낸다.
// exampleText/exampleStart/exampleEnd/exampleTranslation/exampleWordSpans는 이 단어의
// 예문 — 실제로 쓰인 가사 소절(있으면 그쪽 우선)이거나, 아직 어느 공개 곡에도 등장하지 않은
// 단어라면 AI가 만든 예문(WordExampleService)이다. 어느 쪽이든 프론트에서는 구분할 필요가
// 없도록 같은 모양으로 내려준다 — 예문이 전혀 없으면(AI도 못 만들었으면) 전부 null.
// exampleWords: 그 예문에 등장하는 "사전에 매칭되는" 단어들(스터디 중인 단어 포함)의
// 표제어/발음/뜻 — 빈칸 채우기 정답 화면에서 예문 전체의 단어 뜻을 같이 보여주는 데 쓴다.
// similarLemmas: 빈칸 채우기 오답 보기를 단어장 밖 단어로도 넓히기 위한, 발음/뜻이 헷갈릴
// 수 있는 같은 언어의 다른 단어 표제어 몇 개.
public record WordbookItemResponse(
        Long id,
        Long wordId,
        String lemma,
        Lang lang,
        String reading,
        List<String> meanings,
        boolean starred,
        WordbookItemStatus status,
        int intervalDays,
        int repetitionCount,
        LocalDateTime nextReviewAt,
        String exampleText,
        Integer exampleStart,
        Integer exampleEnd,
        String exampleTranslation,
        List<WordSpan> exampleWordSpans,
        List<ExampleWord> exampleWords,
        List<String> similarLemmas
) {
    /**
     * @param progress 이 단어의 학습 진행 상태(UserWordProgress) — 사용자+단어 단위로 하나뿐이라
     *                 어느 단어장에서 보든 동일하다. 한 번도 복습한 적 없는 단어는 아직 행 자체가
     *                 없을 수 있으므로 null 가능 — 그 경우 기본값(LEARNING/1일/0회/null)으로 채운다.
     */
    public static WordbookItemResponse of(
            WordbookItem item,
            UserWordProgress progress,
            List<WordMeaning> meanings,
            String exampleText,
            Integer exampleStart,
            Integer exampleEnd,
            String exampleTranslation,
            List<WordSpan> exampleWordSpans,
            List<ExampleWord> exampleWords,
            List<String> similarLemmas
    ) {
        Word word = item.getWord();
        return new WordbookItemResponse(
                item.getId(),
                word.getId(),
                word.getLemma(),
                word.getLang(),
                word.getReading(),
                meanings.stream().map(WordMeaning::getMeaningText).toList(),
                item.isStarred(),
                progress != null ? progress.getStatus() : WordbookItemStatus.LEARNING,
                progress != null ? progress.getIntervalDays() : 1,
                progress != null ? progress.getRepetitionCount() : 0,
                progress != null ? progress.getNextReviewAt() : null,
                exampleText,
                exampleStart,
                exampleEnd,
                exampleTranslation,
                exampleWordSpans == null ? List.of() : exampleWordSpans,
                exampleWords == null ? List.of() : exampleWords,
                similarLemmas == null ? List.of() : similarLemmas
        );
    }
}
