// 로그아웃 시(TopBar.jsx의 handleLogout) 전환 오버레이가 랜딩 페이지의 보라색
// 히어로 영역(.landing-hero)으로 정확히 "모여들게" 하려면 그 실제 크기/위치를
// 알아야 하는데, 로그아웃하는 시점엔 Landing이 아직 마운트되어 있지 않아 DOM을
// 직접 잴 수 없다. 그래서 Landing.jsx가 마운트/리사이즈될 때마다 자기 히어로의
// 실제 getBoundingClientRect()를 여기 모듈 전역에 기억해두고, TopBar.jsx는
// 로그아웃할 때 그 "마지막으로 알려진" 값을 꺼내 쓴다 — 화면 크기만 보고
// 어림짐작(예: 상단바 높이만 빼고 나머지를 전부 차지한다고 가정)하면 히어로가
// 실제로는 콘텐츠 높이만큼만 차지해서 애니메이션이 끝나는 자리와 어긋난다.
//
// 이번 세션에서 한 번도 랜딩 페이지를 거치지 않고 로그인된 채로 들어온 경우
// (새로고침으로 토큰이 남아있는 등) 캐시가 비어있을 수 있어서, 그때 쓸 대략적인
// 기본값도 같이 둔다 — 실제 랜딩 히어로 비율(패딩 96+120 + 타이틀/서브타이틀/버튼
// 콘텐츠)을 화면 높이에 대략 대입한 값이라 완전히 정확하진 않지만, 아예 못 구하는
// 것보단 훨씬 낫다.
let lastRect = null

export function rememberLandingHeroRect(rect) {
  lastRect = rect
}

export function getLastKnownLandingHeroRect() {
  if (lastRect) return lastRect
  // 기본값 — 전형적인 데스크톱 화면에서 실측한 히어로 비율에 맞춘 어림값.
  const height = Math.min(window.innerHeight - 72, 760)
  return {
    top: 72,
    left: 0,
    width: window.innerWidth,
    height: Math.max(height, 0),
  }
}
