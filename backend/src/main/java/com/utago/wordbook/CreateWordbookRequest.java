package com.utago.wordbook;

// folderId는 선택 — 비워두면(null) 폴더 없이 만들어진다.
public record CreateWordbookRequest(String name, Long folderId) {}
