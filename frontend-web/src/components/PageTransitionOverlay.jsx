import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { onPageTransition } from '../utils/pageTransition'
import './PageTransitionOverlay.css'

// 랜딩 페이지의 "무료로 시작하기" 또는 "로그인"을 누르면:
// 1) 보라색 히어로 영역이 화면 전체를 채우도록 커지고
// 2) (이 사이에 실제 라우트를 /signup 또는 /login 으로 전환하고)
// 3) 목적지 페이지의 좌측 브랜드 패널 크기로 다시 줄어들면서
//    (오른쪽에서부터) 폼이 드러난다.
// 회원가입/로그인 페이지 둘 다 브랜드 패널 크기(40%, 최소 360px)와
// 그라데이션이 동일해서 같은 애니메이션을 그대로 재사용할 수 있다.
//
// 목적지 페이지가 아직 마운트되기 전에 이 애니메이션이 시작돼야 하므로,
// App.jsx 최상단(Router 안쪽, Routes와 형제)에 이 오버레이를 상주시키고
// pageTransition.js 버스로 신호를 받는다.

const GROW_MS = 480
const HOLD_MS = 180
const SHRINK_MS = 640
const FADE_MS = 180

function getBrandPanelRect() {
  const width = Math.max(window.innerWidth * 0.4, 360)
  return { top: 0, left: 0, width, height: window.innerHeight }
}

export default function PageTransitionOverlay() {
  const navigate = useNavigate()
  const [state, setState] = useState(null) // { rect, opacity }
  const timeoutsRef = useRef([])

  useEffect(() => {
    return onPageTransition(({ rect, to, opts = {} }) => {
      // 진행 중이던 타이머가 있으면 정리
      timeoutsRef.current.forEach(clearTimeout)
      timeoutsRef.current = []

      const variant = opts.variant // 'topbar'면 상단바 전용 스타일(가로 그라데이션, 원 숨김)
      const getShrinkRect = opts.getShrinkRect || getBrandPanelRect

      // 1단계: 클릭된 버튼이 속한 히어로 영역(또는 로그인 브랜드 패널)의 실제 위치/크기에서 시작
      setState({ rect, opacity: 1, animate: false, variant })

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // 2단계: 화면 전체를 채우도록 확대
          setState({
            rect: { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight },
            opacity: 1,
            animate: true,
            phase: 'grow',
            variant,
          })
        })
      })

      timeoutsRef.current.push(
        setTimeout(() => {
          // 3단계: 화면을 다 채운 상태에서 잠깐 멈췄다가 다음 단계로 넘어가야
          // "채우자마자 훅 이동"하는 느낌 없이 자연스럽다.
          timeoutsRef.current.push(
            setTimeout(() => {
              // 오버레이가 화면을 이미 다 덮은 이 시점에, 화면 전환과 동시에 일어나야
              // 하지만 보여서는 안 되는 상태 변경이 있으면 처리한다(예: 로그아웃).
              opts.onReveal?.()
              // fromTransition 플래그를 history state에 실어 보내서, 목적지
              // 페이지가 "전환 애니메이션을 타고 왔을 때만" 로고 페이드인을
              // 재생하고, 뒤로가기/앞으로가기나 새로고침으로 바로 들어왔을
              // 땐 즉시 보이도록 구분할 수 있게 한다.
              navigate(to, { state: { fromTransition: true }, replace: !!opts.replace })

              // 4단계: 목적지 브랜드 패널(또는 상단바) 크기로 축소 — 왼쪽/위에 붙은 채
              // 나머지만 줄어들며 뒤에서 실제 목적지 화면이 드러난다.
              // getShrinkRect()를 navigate() 직후 바로 부르면 아직 목적지 페이지가
              // 마운트되기 전이라(React가 라우트 전환을 비동기로 커밋한다), 로그아웃→
              // 랜딩처럼 getShrinkRect가 "방금 마운트된 페이지가 실측해 기억해둔 값"에
              // 의존하는 경우 그 값이 없어 부정확한 기본값을 쓰게 되고, 그 결과 줄어드는
              // 목표 크기가 실제 목적지 요소와 어긋나 "줄어들다 멈추고 갑자기 바뀌는"
              // 티가 났다(2026-10-08 피드백). rAF 두 번을 기다려 목적지 페이지가 실제로
              // 마운트·측정(Landing.jsx의 useLayoutEffect)까지 끝난 뒤에 읽는다.
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  setState({ rect: getShrinkRect(), opacity: 1, animate: true, phase: 'shrink', variant })

                  timeoutsRef.current.push(
                    setTimeout(() => {
                      // 5단계: 이 시점엔 오버레이 크기가 실제 목적지 요소(브랜드 패널/상단바)와
                      // 정확히 같아서 살짝 페이드아웃해도 이음매가 보이지 않는다.
                      setState((s) => (s ? { ...s, opacity: 0 } : s))
                      timeoutsRef.current.push(setTimeout(() => setState(null), FADE_MS))
                    }, SHRINK_MS)
                  )
                })
              })
            }, HOLD_MS)
          )
        }, GROW_MS)
      )
    })
  }, [navigate])

  useEffect(() => {
    return () => timeoutsRef.current.forEach(clearTimeout)
  }, [])

  if (!state) return null

  const isTopbar = state.variant === 'topbar'
  const isHero = state.variant === 'hero'

  return (
    <div
      className={[
        'page-transition-overlay',
        state.animate ? `page-transition-overlay--${state.phase}` : '',
        isTopbar ? 'page-transition-overlay--topbar' : '',
        isHero ? 'page-transition-overlay--hero' : '',
      ].filter(Boolean).join(' ')}
      style={{
        top: state.rect.top,
        left: state.rect.left,
        width: state.rect.width,
        height: state.rect.height,
        opacity: state.opacity,
      }}
    >
      {/* 상단바로 수축하는 전환(topbar variant)은 실제 TopBar처럼 장식 원이 없어서,
          그 사이에도 원을 숨겨야 결과물(진짜 TopBar)과 이질감이 없다. */}
      {!isTopbar && (
        <>
          <div className="page-transition-overlay-circle page-transition-overlay-circle--top" />
          <div className="page-transition-overlay-circle page-transition-overlay-circle--bottom" />
        </>
      )}
    </div>
  )
}
