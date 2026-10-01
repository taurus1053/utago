package com.utago.wordbook;

import java.util.List;

/** 단어장 목록 화면 "수정" — 오타/잘못 입력한 발음·뜻을 고친다. 단어(lemma)는 고치지 않는다. */
public record UpdateWordbookItemWordRequest(String reading, List<String> meanings) {}
