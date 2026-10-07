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
// opts (전부 선택):
//   - getShrinkRect(): 화면을 다 채운 뒤 줄어들 목표 사각형을 계산하는 함수.
//     생략하면 기존 기본값(좌측 브랜드 패널 크기)을 쓴다 — 랜딩→로그인/회원가입용.
//     로그인→홈처럼 "상단바가 되는" 전환은 {top:0,left:0,width:화면폭,height:64}를 넘긴다.
//   - variant: 'topbar'면 그라데이션 각도를 TopBar와 동일한 가로(90deg)로 바꾸고
//     장식용 원(circle)을 숨긴다 — 얇은 상단바가 됐을 때 어색하지 않도록.
//     'hero'면 장식 원 크기/위치를 랜딩 히어로(.landing-hero-circle)와 똑같이
//     맞춘다 — 로그아웃처럼 랜딩 히어로 크기로 줄어드는 전환에서 쓴다.
//   - replace: true면 navigate를 history replace로 호출(로그인 성공 후 뒤로가기로
//     로그인 화면에 다시 들어가지 않도록).
//   - onReveal(): 화면을 다 채우고 잠깐 멈춘 뒤, navigate() 바로 직전에 호출된다.
//     이 시점엔 오버레이가 화면 전체를 가리고 있으므로, 화면 전환과 동시에 일어나야
//     하지만 보여서는 안 되는 상태 변경(예: 로그아웃 — 토큰을 지우는 순간 라우트가
//     즉시 갈라지는데, 오버레이가 다 덮기 전에 지워버리면 그 틈이 그대로 보인다)을
//     여기서 하면 된다.
export function startPageTransition(rect, to, opts = {}) {
  listeners.forEach((handler) => handler({ rect, to, opts }))
}
