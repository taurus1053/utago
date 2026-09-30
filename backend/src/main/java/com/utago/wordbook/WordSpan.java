package com.utago.wordbook;

// 문장 재배열 게임에서 예문(exampleText)을 "단어 단위"로 쪼개기 위한, 그 소절 안에 등장하는
// 단어 하나의 char offset 구간. 뜻/원형 같은 정보는 필요 없어서 최소한으로만 둔다 — 프론트
// 에서 exampleText.slice(start, end)로 그 단어의 표면형을 잘라 타일 하나로 쓴다.
public record WordSpan(int start, int end) {
}
