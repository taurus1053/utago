package com.utago.wordbook;

import com.utago.common.Lang;

// 곡 학습 화면 "단어장에 추가" 버튼. wordbookId를 생략하면 기본(즐겨찾기) 단어장에 담긴다.
public record AddWordbookItemRequest(String lemma, Lang lang, Long wordbookId) {}
