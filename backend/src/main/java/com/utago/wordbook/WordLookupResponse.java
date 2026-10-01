package com.utago.wordbook;

import java.util.List;

/**
 * 단어장 "단어 추가" 화면 — 단어(lemma) 입력 중 자동 조회(GET /api/wordbooks/items/lookup)
 * 결과. 발음/뜻 입력칸을 자동으로 채우는 데 쓰고, 사용자가 그 값을 고칠 수 있다.
 *
 * found=false면 마스터 사전에도 JMdict에도 없는 단어 — reading/meanings는 빈 값으로 오고,
 * 프론트는 "사전에 없는 단어예요. 발음과 뜻을 직접 입력해주세요" 안내를 보여주면 된다.
 */
public record WordLookupResponse(String lemma, String reading, List<String> meanings, boolean found) {}
