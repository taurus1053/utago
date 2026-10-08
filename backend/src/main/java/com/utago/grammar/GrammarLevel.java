package com.utago.grammar;

/**
 * JLPT 문법 레벨 — 곡과 무관한 "문법 학습" 섹션(claude/기획_정리.md 참고, 2026-10-08 신규)의
 * 분류 기준. N5(가장 쉬움) ~ N1(가장 어려움) 순서. Word 쪽에는 이미 레벨 개념이 없이
 * 단어장 이름으로만 구분돼있었지만(JlptWordbookSeedRunner), 문법은 레벨별 탭/필터 UI가
 * 필요해서 처음부터 enum으로 둔다.
 */
public enum GrammarLevel {
    N5,
    N4,
    N3,
    N2,
    N1
}
