package com.utago.dictionary;

/**
 * 사전 단어 미리 채우기 관리 화면 — 한 번의 배치 호출 결과.
 * seeded==0 이면 더 채울 JMdict 상용어가 남아있지 않다는 뜻(완료).
 */
public record DictionarySeedBatchResponse(int seeded) {}
