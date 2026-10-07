package com.utago.wordbook;

// 플래시카드 복습 화면에서 "안다"(true)/"모른다"(false) 버튼.
// method(V29, 2026-10-08 추가) — 5개 학습 게임 중 어떤 방법으로 복습했는지(flashcard/quiz/
// fill/reorder/match, StudySession.jsx 식별자 그대로). 칭호 "학습 방법별"(STUDY_METHOD)의
// 원천 데이터 — 구버전 프론트가 이 필드 없이 보내도 null로 들어와 그냥 무시되므로 안전하다.
public record ReviewWordbookItemRequest(boolean know, String method) {}
