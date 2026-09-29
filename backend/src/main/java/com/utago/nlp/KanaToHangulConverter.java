package com.utago.nlp;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 히라가나 읽기(발음)를 한글 발음 표기로 바꾸는 간단한 음차 변환기 — AI 호출 없이 순수
 * 규칙 기반으로 동작한다(가나-한글 대응표 기반, 흔히 쓰는 일본어 학습 자료의 표기를 따름).
 *
 * 완벽한 외래어 표기법이 목적이 아니라 "이 가사가 대략 어떻게 들리는지" 알려주는 발음
 * 가이드가 목적이라, っ(촉음)은 ㅅ/ㅂ 받침으로, ん(발음)은 ㄴ 받침으로, ー(장음부호)는
 * 직전 모음을 한 번 더 붙이는 식으로 단순화했다. 매핑에 없는 문자(한자 변환 실패, 로마자,
 * 기호 등)는 그대로 통과시킨다.
 */
@Component
public class KanaToHangulConverter {

    // 한글 음절 분해/조합에 쓰는 표준 자모 순서(유니코드 한글 음절 조합 공식 기준).
    private static final String JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
    private static final int JONG_NIEUN = 4; // ㄴ
    private static final int JONG_BIEUP = 17; // ㅂ
    private static final int JONG_SIOT = 19; // ㅅ

    private static final Map<String, String> YOUON_MAP = new HashMap<>();
    private static final Map<String, String> SEION_MAP = new HashMap<>();

    static {
        // 요음(작은 ゃゅょ 결합)
        put(YOUON_MAP, "きゃ", "캬", "きゅ", "큐", "きょ", "쿄");
        put(YOUON_MAP, "ぎゃ", "갸", "ぎゅ", "규", "ぎょ", "교");
        put(YOUON_MAP, "しゃ", "샤", "しゅ", "슈", "しょ", "쇼");
        put(YOUON_MAP, "じゃ", "자", "じゅ", "주", "じょ", "조");
        put(YOUON_MAP, "ちゃ", "차", "ちゅ", "추", "ちょ", "초");
        put(YOUON_MAP, "にゃ", "냐", "にゅ", "뉴", "にょ", "뇨");
        put(YOUON_MAP, "ひゃ", "햐", "ひゅ", "휴", "ひょ", "효");
        put(YOUON_MAP, "びゃ", "뱌", "びゅ", "뷰", "びょ", "뵤");
        put(YOUON_MAP, "ぴゃ", "퍄", "ぴゅ", "퓨", "ぴょ", "표");
        put(YOUON_MAP, "みゃ", "먀", "みゅ", "뮤", "みょ", "묘");
        put(YOUON_MAP, "りゃ", "랴", "りゅ", "류", "りょ", "료");

        // 청음(기본 46음)
        put(SEION_MAP, "あ", "아", "い", "이", "う", "우", "え", "에", "お", "오");
        put(SEION_MAP, "か", "카", "き", "키", "く", "쿠", "け", "케", "こ", "코");
        put(SEION_MAP, "さ", "사", "し", "시", "す", "스", "せ", "세", "そ", "소");
        put(SEION_MAP, "た", "타", "ち", "치", "つ", "츠", "て", "테", "と", "토");
        put(SEION_MAP, "な", "나", "に", "니", "ぬ", "누", "ね", "네", "の", "노");
        put(SEION_MAP, "は", "하", "ひ", "히", "ふ", "후", "へ", "헤", "ほ", "호");
        put(SEION_MAP, "ま", "마", "み", "미", "む", "무", "め", "메", "も", "모");
        put(SEION_MAP, "や", "야", "ゆ", "유", "よ", "요");
        put(SEION_MAP, "ら", "라", "り", "리", "る", "루", "れ", "레", "ろ", "로");
        put(SEION_MAP, "わ", "와", "ゐ", "이", "ゑ", "에", "を", "오");

        // 탁음
        put(SEION_MAP, "が", "가", "ぎ", "기", "ぐ", "구", "げ", "게", "ご", "고");
        put(SEION_MAP, "ざ", "자", "じ", "지", "ず", "즈", "ぜ", "제", "ぞ", "조");
        put(SEION_MAP, "だ", "다", "ぢ", "지", "づ", "즈", "で", "데", "ど", "도");
        put(SEION_MAP, "ば", "바", "び", "비", "ぶ", "부", "べ", "베", "ぼ", "보");

        // 반탁음
        put(SEION_MAP, "ぱ", "파", "ぴ", "피", "ぷ", "푸", "ぺ", "페", "ぽ", "포");
    }

    private static void put(Map<String, String> map, String... pairs) {
        for (int i = 0; i < pairs.length; i += 2) {
            map.put(pairs[i], pairs[i + 1]);
        }
    }

    public String convert(String hiragana) {
        if (hiragana == null || hiragana.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder(hiragana.length());
        int lastJungIndex = -1;

        int i = 0;
        while (i < hiragana.length()) {
            char c = hiragana.charAt(i);

            if (i + 1 < hiragana.length()) {
                String two = hiragana.substring(i, i + 2);
                String mapped = YOUON_MAP.get(two);
                if (mapped != null) {
                    sb.append(mapped);
                    lastJungIndex = jungIndexOf(mapped.charAt(0));
                    i += 2;
                    continue;
                }
            }

            if (c == 'っ') {
                char next = i + 1 < hiragana.length() ? hiragana.charAt(i + 1) : 0;
                int jong = (next == 'ぱ' || next == 'ぴ' || next == 'ぷ' || next == 'ぺ' || next == 'ぽ')
                        ? JONG_BIEUP : JONG_SIOT;
                attachBatchimToLast(sb, jong);
                i += 1;
                continue;
            }

            if (c == 'ん') {
                attachBatchimToLast(sb, JONG_NIEUN);
                if (sb.length() == 0) {
                    sb.append('은');
                }
                i += 1;
                continue;
            }

            if (c == 'ー') {
                if (lastJungIndex >= 0) {
                    sb.append(JUNG.charAt(lastJungIndex));
                }
                i += 1;
                continue;
            }

            String one = String.valueOf(c);
            String mapped = SEION_MAP.get(one);
            if (mapped != null) {
                sb.append(mapped);
                lastJungIndex = jungIndexOf(mapped.charAt(0));
                i += 1;
                continue;
            }

            // 매핑에 없는 문자(공백, 기호, 한자, 로마자 등)는 그대로 둔다.
            sb.append(c);
            i += 1;
        }
        return sb.toString();
    }

    private void attachBatchimToLast(StringBuilder sb, int jongIndex) {
        if (sb.length() == 0) {
            return;
        }
        char last = sb.charAt(sb.length() - 1);
        int[] d = decompose(last);
        if (d == null || d[2] != 0) {
            // 한글 음절이 아니거나 이미 받침이 있으면 건드리지 않는다(단순화된 근사치).
            return;
        }
        sb.setCharAt(sb.length() - 1, compose(d[0], d[1], jongIndex));
    }

    private int jungIndexOf(char hangul) {
        int[] d = decompose(hangul);
        return d == null ? -1 : d[1];
    }

    /** 완성형 한글 음절 하나를 [초성, 중성, 종성] 인덱스로 분해. 한글 음절이 아니면 null. */
    private int[] decompose(char syllable) {
        int code = syllable - 0xAC00;
        if (code < 0 || code > 11171) {
            return null;
        }
        int cho = code / (21 * 28);
        int jung = (code % (21 * 28)) / 28;
        int jong = code % 28;
        return new int[]{cho, jung, jong};
    }

    private char compose(int cho, int jung, int jong) {
        return (char) (0xAC00 + (cho * 21 + jung) * 28 + jong);
    }
}
