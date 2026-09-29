package com.utago.nlp;

import com.atilika.kuromoji.ipadic.Token;
import com.atilika.kuromoji.ipadic.Tokenizer;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * 일본어 소절 텍스트를 형태소 단위로 쪼개서 (1) 한자 위 후리가나(읽기)와
 * (2) 단어장/뜻 팝업에 쓸 "의미 있는 단어"만 골라내는 서비스.
 * Kuromoji(순수 자바, 오프라인 사전 기반)를 쓰기 때문에 외부 API 호출이나 비용이 없다 —
 * 앞서 이야기한 "AI 번역"(유료 API 필요)과는 완전히 별개의 파이프라인.
 */
@Component
public class JapaneseTokenizerService {

    /** 조사/조동사/기호/공백처럼 단어장에 넣을 가치가 없는 품사는 제외한다. */
    private static final Set<String> SKIP_POS = Set.of("助詞", "助動詞", "記号", "空白", "接続詞", "連体詞");

    /** 줄 전체 발음 표기를 구간(단어 단위)으로 나눌 때, 항상 앞 구간에 붙어야 하는
     * 품사(대분류) — 조사/조동사류는 독립된 구간으로 취급하지 않는다. */
    private static final Set<String> ALWAYS_ATTACH_POS1 = Set.of("助詞", "助動詞", "記号", "空白", "接続詞", "連体詞");

    /** 세분류(품사 대분류가 독립어라도)가 이거면 접미사/의존형태소라 앞 구간에 붙는다. */
    private static final Set<String> DEPENDENT_POS2 = Set.of("非自立", "接尾");

    private final Tokenizer tokenizer = new Tokenizer();

    public record TokenSpan(
            String surface,
            int charOffsetStart,
            int charOffsetEnd,
            /** 히라가나 읽기. 가나로만 된 토큰(한자 없음)이면 null — 후리가나를 달 필요가 없으므로. */
            String furigana,
            /** 사전형(기본형) — Word.lemma 로 저장/재사용되는 값 */
            String baseForm,
            String partOfSpeech,
            boolean vocabWorthy
    ) {}

    public List<TokenSpan> tokenize(String text) {
        List<TokenSpan> result = new ArrayList<>();
        int cursor = 0;
        for (Token token : tokenizer.tokenize(text)) {
            String surface = token.getSurface();
            int start = text.indexOf(surface, cursor);
            if (start < 0) {
                // 정규화 등으로 원문과 어긋나면 이 토큰은 위치를 신뢰할 수 없으니 건너뜀.
                continue;
            }
            int end = start + surface.length();
            cursor = end;

            String pos = token.getPartOfSpeechLevel1();
            boolean hasKanji = containsKanji(surface);
            String reading = token.getReading(); // 가타카나, 분석 실패 시 "*"
            String furigana = (hasKanji && reading != null && !reading.equals("*"))
                    ? katakanaToHiragana(reading)
                    : null;

            boolean vocabWorthy = !SKIP_POS.contains(pos) && surface.trim().length() > 0;

            String baseForm = token.getBaseForm();
            if (baseForm == null || baseForm.equals("*")) {
                baseForm = surface;
            }

            result.add(new TokenSpan(surface, start, end, furigana, baseForm, pos, vocabWorthy));
        }
        return result;
    }

    /**
     * 줄 전체 발음 표기 생성(SongLineReadingService)에 쓰는, 한 토큰의 모든 정보.
     * reading은 한자든 가나든 관계없이 항상 채워진다(가나 토큰은 표면형 자체가 이미 읽기이므로
     * 그대로, 인식 실패한 토큰은 표면형을 그대로 폴백).
     */
    public record ReadingToken(
            String surface,
            int charOffsetStart,
            int charOffsetEnd,
            String reading,
            String baseForm,
            String partOfSpeechLevel1,
            String partOfSpeechLevel2
    ) {
        /** 이 토큰이 (조사/조동사/접미사 등에 안 붙고) 새 구간을 시작할 수 있는 자립어인지. */
        public boolean isIndependent() {
            if (ALWAYS_ATTACH_POS1.contains(partOfSpeechLevel1)) return false;
            return !DEPENDENT_POS2.contains(partOfSpeechLevel2);
        }
    }

    /**
     * 소절 원문을 형태소 단위로 분석해서, 줄 전체 발음 표기를 구간(대략 문절 단위)으로
     * 나눌 수 있게 필요한 정보를 전부 담아 돌려준다. tokenize()와 별개로 두는 이유는
     * tokenize()의 furigana는 한자 토큰에만 채워지지만, 여기서는 조사처럼 가나뿐인
     * 토큰도 읽기가 항상 필요하기 때문.
     */
    public List<ReadingToken> analyzeForReading(String text) {
        List<ReadingToken> result = new ArrayList<>();
        int cursor = 0;
        for (Token token : tokenizer.tokenize(text)) {
            String surface = token.getSurface();
            int start = text.indexOf(surface, cursor);
            if (start < 0) {
                continue;
            }
            int end = start + surface.length();
            cursor = end;

            String rawReading = token.getReading(); // 가타카나, 분석 실패 시 "*"
            String reading = (rawReading != null && !rawReading.equals("*"))
                    ? katakanaToHiragana(rawReading)
                    : surface;

            String baseForm = token.getBaseForm();
            if (baseForm == null || baseForm.equals("*")) {
                baseForm = surface;
            }

            result.add(new ReadingToken(
                    surface, start, end, reading, baseForm,
                    token.getPartOfSpeechLevel1(), token.getPartOfSpeechLevel2()));
        }
        return result;
    }

    private boolean containsKanji(String s) {
        return s.codePoints().anyMatch(cp -> cp >= 0x4E00 && cp <= 0x9FFF);
    }

    private String katakanaToHiragana(String katakana) {
        StringBuilder sb = new StringBuilder(katakana.length());
        for (int i = 0; i < katakana.length(); i++) {
            char c = katakana.charAt(i);
            if (c >= 0x30A1 && c <= 0x30F6) {
                sb.append((char) (c - 0x60));
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
