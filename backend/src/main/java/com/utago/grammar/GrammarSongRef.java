package com.utago.grammar;

/** 문법 상세 화면의 "이 문법이 쓰인 노래" 한 줄 — GrammarPointRepository.findByGrammarEntry_Id로 역추적. */
public record GrammarSongRef(Long songId, String title, String artist) {
}
