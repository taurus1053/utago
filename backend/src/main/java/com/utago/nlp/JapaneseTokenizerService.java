package com.utago.nlp;

import com.atilika.kuromoji.ipadic.Token;
import com.atilika.kuromoji.ipadic.Tokenizer;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

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

    /**
     * 한자 동형이의어(같은 한자, 문맥에 따라 다른 읽기) 보정 규칙.
     *
     * Kuromoji(IPADIC)는 통계적으로 더 흔한 읽기 하나만 고르기 때문에, 예를 들어 止める는
     * 거의 항상 とめる(물리적으로 멈추다)로만 분석되고 やめる(그만두다) 읽기는 나오지 않는다
     * — 전형적인 캐시 문제(君/쿤)와 달리 이건 형태소 분석기 자체의 한계라서, 매번 발견될
     * 때마다 가사를 일일이 수작업으로 고칠 수 없다. 대신 사전형(baseForm) + 뒤따르는 문맥을
     * 정규식으로 검사해서, 특정 패턴일 때만 읽기를 자동으로 바꿔치기한다.
     *
     * 새로운 동형이의어 오류가 발견되면 여기에 규칙을 하나 추가하는 것으로 전 곡에 걸쳐
     * 한 번에 고쳐진다 — 이게 이 테이블을 두는 이유.
     */
    private record HomographOverride(String wrongReadingPrefix, String correctReadingPrefix, Pattern followingContext) {}

    private static final Map<String, List<HomographOverride>> HOMOGRAPH_OVERRIDES = Map.of(
            "止める", List.of(
                    // "…にしよう/にする/にした" 처럼 "그만두기로 하다"라는 의미로 쓰일 때는
                    // とめる가 아니라 やめる로 읽어야 한다. (예: "止めにしようかな" -> "やめにしようかな")
                    new HomographOverride("とめ", "やめ", Pattern.compile("^に(しよう|します|しない|した|して|する)"))
            )
    );

    /**
     * 위 규칙표를 실제 읽기(히라가나)에 적용한다. 규칙에 안 걸리면 원래 읽기를 그대로 돌려준다.
     * tokenize()/analyzeForReading() 내부에서뿐 아니라, 이미 캐시된 Word.reading을 재사용하는
     * SongLineReadingService(줄 전체 발음 표기)에서도 그대로 다시 적용할 수 있도록 public.
     */
    public String applyHomographOverride(String baseForm, String reading, String followingText) {
        if (reading == null || baseForm == null) return reading;
        List<HomographOverride> rules = HOMOGRAPH_OVERRIDES.get(baseForm);
        if (rules == null) return reading;
        for (HomographOverride rule : rules) {
            if (reading.startsWith(rule.wrongReadingPrefix())
                    && rule.followingContext().matcher(followingText == null ? "" : followingText).find()) {
                return rule.correctReadingPrefix() + reading.substring(rule.wrongReadingPrefix().length());
            }
        }
        return reading;
    }

    private final Tokenizer tokenizer = new Tokenizer();

    public record TokenSpan(
            String surface,
            int charOffsetStart,
            int charOffsetEnd,
            /** 히라가나 읽기. 가나로만 된 토큰(한자 없음)이면 null — 후리가나를 달 필요가 없으므로.
             * 이 값은 "이 문장 안에서 실제로 쓰인 표면형(surface)"의 읽기다 — 예를 들어
             * "繋いで"라는 활용형이면 furigana는 그 활용형의 읽기(つない…)가 된다.
             * 문장 속 후리가나 표시(ruby)에는 이게 맞지만, 단어장에 저장할 사전형 읽기로
             * 쓰면 안 된다(아래 lemmaReading 참고). */
            String furigana,
            /** 사전형(기본형) — Word.lemma 로 저장/재사용되는 값 */
            String baseForm,
            /** baseForm(사전형) 그 자체의 읽기. Word.reading으로 저장할 때는 반드시 이걸 써야 한다 —
             * furigana는 문맥 속 활용형의 읽기라서 사전형과 다를 수 있다(예: 繋ぐ 활용형인
             * 繋いで의 furigana는 "つない"지만, 사전형 繋ぐ의 올바른 읽기는 "つなぐ"). */
            String lemmaReading,
            String partOfSpeech,
            boolean vocabWorthy
    ) {}

    public List<TokenSpan> tokenize(String text) {
        List<TokenSpan> result = new ArrayList<>();
        int cursor = 0;
        String prevPos1 = null;
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

            String baseForm = token.getBaseForm();
            if (baseForm == null || baseForm.equals("*")) {
                baseForm = surface;
            }

            // 가사에 섞인 영어 단어(예: "Age")를 Kuromoji가 명사로 오인식해서 단어장 후보로
            // 잡아내는 경우가 있다 — 일본어 학습용 곡에서 로마자로만 된 토큰은 "배울 일본어
            // 단어"가 아니므로(발음/한자 학습 대상이 아님) 애초에 단어장 후보에서 제외한다.
            // 순수 숫자("4" 등)도 마찬가지로 "배울 단어"가 아니라서 제외하고, 캐주얼체
            // "~てる"(~ている의 준말)를 동사 照る(비추다)로 오분석한 경우도 걸러낸다
            // (아래 isTeIruContraction 참고).
            boolean vocabWorthy = !SKIP_POS.contains(pos) && surface.trim().length() > 0
                    && !isLatinOnly(surface) && !isNumericOnly(surface)
                    && !isTeIruContraction(baseForm, surface, prevPos1);

            if (furigana != null) {
                furigana = applyHomographOverride(baseForm, furigana, text.substring(end));
            }

            String lemmaReading = containsKanji(baseForm) ? readingForLemma(baseForm) : null;

            result.add(new TokenSpan(surface, start, end, furigana, baseForm, lemmaReading, pos, vocabWorthy));
            prevPos1 = pos;
        }
        return result;
    }

    /** "~てる/てた/てて/てろ/てれば/てない" 캐주얼체 축약형(= ~ている 등에서 い가 빠진 것)을
     * 패턴에 맞춰 걸러낸다. */
    private static final Pattern TE_IRU_CONTRACTION_SURFACE = Pattern.compile("^て(る|た|て|ろ|れば|ない)$");

    /**
     * Kuromoji(IPADIC)는 회화체 축약형 "~てる"(예: "かかってる" = "かかっている"에서 い가
     * 빠진 것)를 문맥을 못 읽고 동사 照る(비추다/빛나다, 사전형이 우연히 똑같이 "てる")로
     * 오인식하는 경우가 있다. 진짜 照る 사용과 구분하기 위해, 직전 토큰이 동사(연용형/て형)일
     * 때만 — 즉 "동사 어간 + てる" 형태일 때만 — 이 축약형으로 간주해 단어장 후보에서 뺀다.
     */
    private boolean isTeIruContraction(String baseForm, String surface, String prevPos1) {
        return "照る".equals(baseForm)
                && TE_IRU_CONTRACTION_SURFACE.matcher(surface).matches()
                && "動詞".equals(prevPos1);
    }

    /**
     * 사전형(baseForm) 문자열 자체를 독립적으로 다시 분석해서, 문맥(활용형)에 흔들리지 않는
     * "사전형 그대로의 읽기"를 돌려준다. 단어장에 저장할 Word.reading은 항상 이걸 써야 한다.
     * 예: "繋いで"를 tokenize()하면 furigana는 활용형 어간의 읽기(つない…)가 나오지만,
     * baseForm은 "繋ぐ"이고 readingForLemma("繋ぐ")는 올바르게 "つなぐ"를 돌려준다.
     */
    public String readingForLemma(String lemma) {
        if (lemma == null || lemma.isEmpty()) return null;
        StringBuilder sb = new StringBuilder();
        for (Token t : tokenizer.tokenize(lemma)) {
            String r = t.getReading();
            if (r == null || r.equals("*")) {
                sb.append(t.getSurface());
            } else {
                sb.append(katakanaToHiragana(r));
            }
        }
        return sb.length() > 0 ? sb.toString() : null;
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

            reading = applyHomographOverride(baseForm, reading, text.substring(end));

            result.add(new ReadingToken(
                    surface, start, end, reading, baseForm,
                    token.getPartOfSpeechLevel1(), token.getPartOfSpeechLevel2()));
        }
        return result;
    }

    private boolean containsKanji(String s) {
        return s.codePoints().anyMatch(cp -> cp >= 0x4E00 && cp <= 0x9FFF);
    }

    /** 로마자(영어 알파벳)로만 된 토큰인지 — 가나/한자가 하나도 없으면 true. */
    private boolean isLatinOnly(String s) {
        return s.codePoints().allMatch(cp -> (cp >= 'A' && cp <= 'Z') || (cp >= 'a' && cp <= 'z'));
    }

    /** 순수 숫자(반각/전각)로만 된 토큰인지 — "4"처럼 명사로 오인식되는 숫자를 걸러내는 데 쓴다. */
    private boolean isNumericOnly(String s) {
        return s.codePoints().allMatch(cp -> (cp >= '0' && cp <= '9') || (cp >= 0xFF10 && cp <= 0xFF19));
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
