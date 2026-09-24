// 랜딩 -> 회원가입 처럼, 페이지를 넘어가는 화면 전환 애니메이션을 위한
// 아주 작은 pub/sub 버스. React Router가 페이지를 언마운트/마운트하는
// 사이에도 전환 오버레이(App.jsx에 상주)가 계속 살아있어야 해서,
// 두 페이지가 직접 props를 주고받는 대신 이 버스를 통해 신호만 주고받는다.

const listeners = new Set()

export function onPageTransition(handler) {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

// rect: 전환을 시작할 때 화면을 채우기 시작하는 기준 사각형
//       (보통 보라색 히어로 영역의 getBoundingClientRect() 결과)
// to: 전환이 끝난 뒤 이동할 경로
export function startPageTransition(rect, to) {
  listeners.forEach((handler) => handler({ rect, to }))
}
