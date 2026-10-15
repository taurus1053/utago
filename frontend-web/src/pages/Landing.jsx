import { useLayoutEffect, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { startPageTransition } from '../utils/pageTransition'
import { rememberLandingHeroRect } from '../utils/landingHeroRect'
import { measureMaxTextWidth } from '../utils/measureText'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS } from '../i18n'
import { useDisplayLang } from '../i18n/useDisplayLang'
import LangSwitcher from '../components/LangSwitcher'
import './Landing.css'

// 비로그인 상태로 사이트에 접속했을 때 보여주는 랜딩(소개) 페이지.
// 넷플릭스/쿠팡플레이 스타일의 "가입/로그인 유도" 페이지.
// 첫 진입점이라 외국인 사용자도 바로 이해할 수 있도록 간단한 언어 선택을 제공한다.
// (언어 선택 드롭다운 자체는 components/LangSwitcher로 분리되어 TopBar에서도 재사용된다.)

const ICONS = {
  song: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7636f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"></path>
      <circle cx="6" cy="18" r="3"></circle>
      <circle cx="18" cy="16" r="3"></circle>
    </svg>
  ),
  grammar: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7636f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"></path>
    </svg>
  ),
  globe: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7636f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M2 12h20"></path>
      <path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"></path>
    </svg>
  ),
}

// 실제 앨범 커버 이미지는 아직 없어서(저작권 있는 이미지라 임의로 가져다 쓰기 어렵고,
// 이 샌드박스에서는 외부 이미지 API 호출도 막혀 있음) 그라데이션 + 음표 아이콘으로
// 그럴듯한 플레이스홀더를 대신 넣었다. 나중에 실제 곡 API(유튜브 썸네일 등)가 생기면
// song.cover 에 실제 이미지 URL을 넣도록 바꾸면 된다.
const POPULAR_SONGS = [
  { title: 'アイドル', artist: 'YOASOBI', gradient: 'linear-gradient(135deg,#f3e2d8,#e9c3ae)' },
  { title: '봄날', artist: '방탄소년단', gradient: 'linear-gradient(135deg,#eef1e6,#d3ddc4)' },
  { title: '怪物', artist: 'YOASOBI', gradient: 'linear-gradient(135deg,#f6d9d0,#eab8ab)' },
  { title: 'Dynamite', artist: 'BTS', gradient: 'linear-gradient(135deg,#e7edf3,#c6d6e6)' },
  { title: 'Shape of You', artist: 'Ed Sheeran', gradient: 'linear-gradient(135deg,#efe6f5,#d9c3ea)' },
  { title: '밤편지', artist: '아이유', gradient: 'linear-gradient(135deg,#fdeee0,#f6cfa8)' },
  { title: '踊り子', artist: 'Vaundy', gradient: 'linear-gradient(135deg,#e3ddf7,#c3b4ec)' },
  { title: '사건의 지평선', artist: '윤하', gradient: 'linear-gradient(135deg,#dceef0,#a9d3d8)' },
  { title: 'Butter', artist: 'BTS', gradient: 'linear-gradient(135deg,#fdf3d0,#f5dd8a)' },
  { title: 'Attention', artist: 'NewJeans', gradient: 'linear-gradient(135deg,#e3f2ee,#b9dfd3)' },
  { title: 'Ditto', artist: 'NewJeans', gradient: 'linear-gradient(135deg,#f0e6f6,#d7bdea)' },
  { title: 'LOVE DIVE', artist: 'IVE', gradient: 'linear-gradient(135deg,#fbe3ec,#f3b8ce)' },
  { title: 'Hype Boy', artist: 'NewJeans', gradient: 'linear-gradient(135deg,#e6f0fb,#bcd7f3)' },
  { title: '群青', artist: 'YOASOBI', gradient: 'linear-gradient(135deg,#dde8f5,#aec8e8)' },
  { title: 'Lemon', artist: '米津玄師', gradient: 'linear-gradient(135deg,#f2f6d8,#dbe4a3)' },
  { title: '打上花火', artist: 'DAOKO×米津玄師', gradient: 'linear-gradient(135deg,#fde6e6,#f3b7ba)' },
  { title: 'Pretender', artist: 'Official髭男dism', gradient: 'linear-gradient(135deg,#e9e3f7,#c9b8e8)' },
  { title: '香水', artist: '瑛人', gradient: 'linear-gradient(135deg,#f7ece0,#e9c9a3)' },
  { title: 'Blinding Lights', artist: 'The Weeknd', gradient: 'linear-gradient(135deg,#efe0ea,#d8a9c4)' },
  { title: 'Perfect', artist: 'Ed Sheeran', gradient: 'linear-gradient(135deg,#e5f1f0,#b7dbd7)' },
]

// 앨범 자켓 무한 스크롤 마퀴.
// CSS keyframe(translateX(-50%))으로 만들면 아이템 개수·gap 값에 따라
// "한 세트 폭"과 "트랙 전체 폭의 절반"이 미묘하게 어긋나서 루프가 이어지는
// 지점에서 살짝 튀는 문제가 있었다. 그래서 실제 DOM에서 "세트 하나"의 폭을
// 직접 측정해서(offsetWidth) 그 값만큼 정확히 돌아가도록 requestAnimationFrame
// 으로 직접 애니메이션한다.
//
// 세트를 2벌만 복제하면, 화면(뷰포트) 폭이 세트 하나의 폭보다 넓을 때
// 스크롤이 세트 폭만큼 진행된 순간 "아직 그려지지 않은 세 번째 세트" 자리가
// 그대로 빈 공간(흰 배경)으로 보이는 문제가 있었다 — 이게 "갭이 크다"는
// 문제의 진짜 원인. 화면 폭 + 세트 폭을 항상 덮을 수 있을 만큼 세트를
// 충분히(동적으로) 복제해서 해결한다.
function Marquee({ items, speed = 40 }) {
  const containerRef = useRef(null)
  const trackRef = useRef(null)
  const setRef = useRef(null)
  const posRef = useRef(0)
  const pausedRef = useRef(false)
  const [copies, setCopies] = useState(3)

  useEffect(() => {
    function recomputeCopies() {
      const containerWidth = containerRef.current ? containerRef.current.offsetWidth : 0
      const setWidth = setRef.current ? setRef.current.offsetWidth : 0
      if (containerWidth > 0 && setWidth > 0) {
        const needed = Math.ceil((containerWidth + setWidth) / setWidth) + 1
        setCopies((prev) => Math.max(prev, needed))
      }
    }
    recomputeCopies()
    window.addEventListener('resize', recomputeCopies)
    return () => window.removeEventListener('resize', recomputeCopies)
  }, [items])

  useEffect(() => {
    let raf
    let last = performance.now()

    function tick(now) {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const setWidth = setRef.current ? setRef.current.offsetWidth : 0
      if (setWidth > 0 && !pausedRef.current) {
        posRef.current = (posRef.current + speed * dt) % setWidth
        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(-${posRef.current}px, 0, 0)`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [speed])

  return (
    <div
      className="landing-marquee"
      ref={containerRef}
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
    >
      <div className="landing-marquee-track" ref={trackRef}>
        {Array.from({ length: copies }).map((_, s) => (
          <div
            key={s}
            className="landing-marquee-set"
            ref={s === 0 ? setRef : null}
            aria-hidden={s === 0 ? undefined : true}
          >
            {items.map((song, i) => (
              <MarqueeItem key={`${s}-${i}`} song={song} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function MarqueeItem({ song }) {
  return (
    <div className="landing-marquee-item">
      <div className="landing-marquee-cover" style={{ background: song.gradient }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
      </div>
      <span className="landing-marquee-song-title">{song.title}</span>
      <span className="landing-marquee-song-artist">{song.artist}</span>
    </div>
  )
}

export default function Landing() {
  // 문구는 i18n/locales/<언어>/landing.json. 표시 언어 선택/저장은 i18n이 전담한다
  // (예전엔 랜딩만의 저장 키(utago_landing_lang)를 따로 썼는데 상단바와 하나로 통합했다).
  const { t, i18n } = useTranslation('landing')
  const [lang, setLang] = useDisplayLang()
  const heroRef = useRef(null)
  const pageRef = useRef(null)

  // "무료로 시작하기" / "로그인"을 누르면 즉시 페이지를 바꾸는 대신, 보라색
  // 히어로 영역이 화면을 가득 채웠다가 목적지 페이지의 브랜드 패널 크기로
  // 줄어들며 자연스럽게 넘어가는 전환 애니메이션을 재생한다.
  function handleBrandNavClick(to) {
    return function (e) {
      e.preventDefault()
      const rect = heroRef.current
        ? heroRef.current.getBoundingClientRect()
        : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
      startPageTransition(
        { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        to
      )
    }
  }

  // 로그아웃 시 이 히어로 영역으로 "모여드는" 역방향 전환(TopBar.jsx)이 정확한
  // 도착 크기를 알 수 있도록, 실제 렌더된 히어로 크기를 기억해둔다 — 창 크기가
  // 바뀌거나(리사이즈) 언어가 바뀌어 줄바꿈이 달라져도 다시 재서 최신 값을 유지한다.
  // useEffect(페인트 이후)가 아니라 useLayoutEffect(커밋 직후, 페인트 전)를 써야
  // 한다 — 로그아웃 전환이 이 마운트 직후 첫 프레임에 바로 값을 읽어가는데,
  // 이 세션에서 랜딩을 한 번도 거치지 않고 로그인한 경우(새로고침 등) useEffect
  // 타이밍으로는 그 첫 요청에 아직 값이 없어 대략값(fallback)이 쓰이고, 그 대략값이
  // 실제 히어로 크기와 달라서 "줄어들다 멈추고 갑자기 바뀌는" 어긋남이 보였다
  // (2026-10-08 피드백).
  useLayoutEffect(() => {
    function measure() {
      if (heroRef.current) {
        rememberLandingHeroRect(heroRef.current.getBoundingClientRect())
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [lang])

  // 로그인/가입하기/무료로 시작하기 버튼은 언어(한국어/일본어/영어)마다 글자
  // 길이가 달라서, 폭을 px로 어림짐작해 고정해두면 실제보다 너무 넉넉하거나
  // (2026-10-07 피드백 — "모든 언어에서 공백이 남는다") 부족해서 줄바꿈될 수
  // 있다. 그래서 캔버스로 세 언어 라벨을 실제 폰트 그대로 재서 가장 넓은 폭을
  // 구하고, 거기에 버튼 좌우 패딩만 더한 값을 CSS 변수로 내려줘서 Landing.css가
  // 그 값을 폭으로 쓰게 한다(언어가 바뀌어도 이 값 자체는 동일하니 버튼 크기가
  // 흔들리지 않는다). 구글 폰트(Noto Sans KR)가 아직 로드되기 전에는 대체
  // 폰트로 재서 약간 부정확할 수 있어서, document.fonts.ready 이후 한 번 더
  // 다시 잰다.
  useLayoutEffect(() => {
    const LOGIN_TEXTS = SUPPORTED_LANGS.map((l) => i18n.getFixedT(l, 'landing')('login'))
    const SIGNUP_TEXTS = SUPPORTED_LANGS.map((l) => i18n.getFixedT(l, 'landing')('signup'))
    // 좌우 패딩(Landing.css의 padding 선언과 맞춰야 한다) + 약간의 여유
    const LOGIN_PAD = 12 * 2 + 4
    const SIGNUP_PAD = 16 * 2 + 4
    const CTA_PAD = 20 * 2 + 4

    function applySizes() {
      const el = pageRef.current
      if (!el) return
      const loginW = Math.ceil(measureMaxTextWidth(LOGIN_TEXTS, "600 13.5px 'Noto Sans KR', system-ui, sans-serif")) + LOGIN_PAD
      const signupW = Math.ceil(measureMaxTextWidth(SIGNUP_TEXTS, "700 13.5px 'Noto Sans KR', system-ui, sans-serif")) + SIGNUP_PAD
      const ctaW = Math.ceil(measureMaxTextWidth(SIGNUP_TEXTS, "700 16px 'Noto Sans KR', system-ui, sans-serif")) + CTA_PAD
      el.style.setProperty('--landing-login-btn-width', `${loginW}px`)
      el.style.setProperty('--landing-signup-btn-width', `${signupW}px`)
      el.style.setProperty('--landing-cta-btn-width', `${ctaW}px`)
    }

    applySizes()
    // 웹폰트가 이 시점에 아직 로드 중이었다면, 로드 완료 후 실제 폰트 메트릭으로
    // 한 번 더 정확히 재조정한다.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(applySizes).catch(() => {})
    }
  }, [i18n])

  return (
    <div className="landing-page" ref={pageRef}>
      {/* 상단바 */}
      <header className="landing-topbar">
        <div className="landing-topbar-logo">
          <img src="/utago-logo-purple.png" alt="UTAGO" className="landing-logo-img" />
        </div>
        <div className="landing-topbar-actions">
          <LangSwitcher lang={lang} setLang={setLang} />
          <Link to="/login" className="landing-login-btn" onClick={handleBrandNavClick('/login')}>{t('login')}</Link>
          <Link to="/signup" className="landing-signup-btn" onClick={handleBrandNavClick('/signup')}>{t('signup')}</Link>
        </div>
      </header>

      {/* 히어로 */}
      <section className="landing-hero" ref={heroRef}>
        <div className="landing-hero-circle landing-hero-circle--top" />
        <div className="landing-hero-circle landing-hero-circle--bottom" />

        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            {t('heroTitle1')}
            <br />
            {t('heroTitle2')}
          </h1>
          <p className="landing-hero-subtitle">
            {t('heroSubtitle').split('\n').map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
          <div className="landing-hero-actions">
            <Link to="/signup" className="landing-cta-btn" onClick={handleBrandNavClick('/signup')}>{t('heroCta')}</Link>
            <Link to="/login" className="landing-hero-login-link" onClick={handleBrandNavClick('/login')}>{t('heroLogin')}</Link>
          </div>
        </div>
      </section>

      {/* 지금 인기있는 곡 - 무한 스크롤 마퀴 */}
      <section className="landing-popular">
        <h2 className="landing-popular-title">{t('popularTitle')}</h2>
        <Marquee items={POPULAR_SONGS} />
      </section>

      {/* 특징 */}
      <section className="landing-features">
        <h2 className="landing-features-title">{t('featuresTitle')}</h2>
        <div className="landing-features-grid">
          {t('features', { returnObjects: true }).map((f) => (
            <div key={f.title} className="landing-feature-card">
              <div className="landing-feature-icon">{ICONS[f.icon]}</div>
              <div className="landing-feature-text-title">{f.title}</div>
              <div className="landing-feature-text-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 하단 CTA */}
      <section className="landing-bottom-cta">
        <h2 className="landing-bottom-cta-title">{t('bottomTitle')}</h2>
        <p className="landing-bottom-cta-subtitle">{t('bottomSubtitle')}</p>
        <Link to="/signup" className="landing-cta-btn landing-cta-btn--light" onClick={handleBrandNavClick('/signup')}>{t('heroCta')}</Link>
      </section>

      <footer className="landing-footer">
        <span>{t('footer')}</span>
        <Link to="/credits" className="landing-footer-link">{t('credits')}</Link>
      </footer>
    </div>
  )
}
