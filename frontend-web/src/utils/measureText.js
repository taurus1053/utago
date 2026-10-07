// 언어별로 버튼 라벨 길이가 다를 때(로그인/가입하기/무료로 시작하기 등), 버튼
// 폭을 "셋 중 가장 긴 언어 기준"으로 고정해서 언어를 바꿔도 크기가 안 흔들리게
// 하려면 실제 렌더 폭을 알아야 한다. px를 어림짐작으로 하드코딩하면 실제보다
// 훨씬 넉넉하게(또는 부족하게) 잡히기 쉬워서(2026-10-07 피드백 — "공백이 남는다"),
// 캔버스의 measureText로 실제 폰트 메트릭 그대로 정확히 잰다.
let sharedCanvas = null

export function measureTextWidth(text, font) {
  if (!sharedCanvas) sharedCanvas = document.createElement('canvas')
  const ctx = sharedCanvas.getContext('2d')
  ctx.font = font
  return ctx.measureText(text).width
}

// texts 중 font로 쟀을 때 가장 넓은 폭을 반환한다.
export function measureMaxTextWidth(texts, font) {
  return Math.max(...texts.map((t) => measureTextWidth(t, font)))
}
