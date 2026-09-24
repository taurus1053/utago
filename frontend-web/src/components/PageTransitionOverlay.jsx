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
    return onPageTransition(({ rect, to }) => {
      // 진행 중이던 타이머가 있으면 정리
      timeoutsRef.current.forEach(clearTimeout)
      timeoutsRef.current = []

      // 1단계: 클릭된 버튼이 속한 히어로 영역의 실제 위치/크기에서 시작
      setState({ rect, opacity: 1, animate: false })

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // 2단계: 화면 전체를 채우도록 확대
          setState({
            rect: { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight },
            opacity: 1,
            animate: true,
            phase: 'grow',
          })
        })
      })

      timeoutsRef.current.push(
        setTimeout(() => {
          // 3단계: 화면을 다 채운 상태에서 잠깐 멈췄다가 다음 단계로 넘어가야
          // "채우자마자 훅 이동"하는 느낌 없이 자연스럽다.
          timeoutsRef.current.push(
            setTimeout(() => {
              // fromTransition 플래그를 history state에 실어 보내서, 목적지
              // 페이지가 "전환 애니메이션을 타고 왔을 때만" 로고 페이드인을
              // 재생하고, 뒤로가기/앞으로가기나 새로고침으로 바로 들어왔을
              // 땐 즉시 보이도록 구분할 수 있게 한다.
              navigate(to, { state: { fromTransition: true } })
              // 4단계: 회원가입 브랜드 패널 크기로 축소 (왼쪽에 붙은 채 오른쪽만
              // 줄어들며 뒤에서 실제 회원가입 화면이 드러난다)
              setState({ rect: getBrandPanelRect(), opacity: 1, animate: true, phase: 'shrink' })

              timeoutsRef.current.push(
                setTimeout(() => {
                  // 5단계: 이 시점엔 오버레이 크기가 실제 브랜드 패널과 정확히 같아서
                  // 살짝 페이드아웃해도 이음매가 보이지 않는다.
                  setState((s) => (s ? { ...s, opacity: 0 } : s))
                  timeoutsRef.current.push(setTimeout(() => setState(null), FADE_MS))
                }, SHRINK_MS)
              )
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

  return (
    <div
      className={`page-transition-overlay${state.animate ? ` page-transition-overlay--${state.phase}` : ''}`}
      style={{
        top: state.rect.top,
        left: state.rect.left,
        width: state.rect.width,
        height: state.rect.height,
        opacity: state.opacity,
      }}
    >
      <div className="page-transition-overlay-circle page-transition-overlay-circle--top" />
      <div className="page-transition-overlay-circle page-transition-overlay-circle--bottom" />
    </div>
  )
}
