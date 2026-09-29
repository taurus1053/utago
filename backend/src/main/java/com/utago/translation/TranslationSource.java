package com.utago.translation;

/** 캐시된 번역이 어디서 왔는지 — ADMIN(운영진이 미리 직접 입력) / AI(Claude가 생성한 뒤 캐시됨). */
public enum TranslationSource {
    ADMIN,
    AI
}
