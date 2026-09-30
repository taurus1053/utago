package com.utago.wordbook;

import java.util.List;

/**
 * 빈칸 채우기 정답 화면 등에서 "이 예문에 나온 다른 단어들의 뜻도 같이 알려주기" 위한 항목.
 * 예문 안의 단어 하나(스터디 중인 단어 포함)의 표제어/발음/뜻. 사전에 매칭되지 않는 조사·
 * 어미 등은 애초에 이 목록에 넣지 않는다(뜻이 없으므로).
 */
public record ExampleWord(String lemma, String reading, List<String> meanings) {
}
