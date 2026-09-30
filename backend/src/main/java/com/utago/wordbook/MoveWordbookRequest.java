package com.utago.wordbook;

// 단어장을 어느 폴더로 옮길지 — folderId가 null이면 "폴더 없음"으로 옮긴다(폴더에서 뺀다).
public record MoveWordbookRequest(Long folderId) {}
