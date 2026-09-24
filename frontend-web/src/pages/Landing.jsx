import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { startPageTransition } from '../utils/pageTransition'
import './Landing.css'

// 비로그인 상태로 사이트에 접속했을 때 보여주는 랜딩(소개) 페이지.
// 넷플릭스/쿠팡플레이 스타일의 "가입/로그인 유도" 페이지.
// 첫 진입점이라 외국인 사용자도 바로 이해할 수 있도록 간단한 언어 선택을 제공한다.

const LANGS = [
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
]

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

const TRANSLATIONS = {
  ko: {
    login: '로그인',
    signup: '무료로 시작하기',
    heroTitle: ['좋아하는 노래로,', '새로운 언어를 배우다'],
    heroSubtitle: '노래 가사를 따라가며 단어·문법·발음을 한 번에,\n우타고와 함께 지금 바로 시작해보세요.',
    heroCta: '무료로 시작하기',
    heroLogin: '이미 계정이 있으신가요? 로그인',
    popularTitle: '지금 인기있는 곡',
    featuresTitle: '우타고만의 학습 방식',
    features: [
      { icon: 'song', title: '좋아하는 노래로 시작', desc: '가사를 따라 부르며 자연스럽게 외국어를 익혀요. 지루한 교재 대신, 좋아하는 곡으로 공부하세요.' },
      { icon: 'grammar', title: '문법까지 한 번에', desc: '가사 속 핵심 문법을 정리해서 보여줘요. 단어와 발음뿐 아니라 문장 구조까지 이해할 수 있어요.' },
      { icon: 'globe', title: '내 모국어에 맞는 발음', desc: '내 모국어에 따라 발음 표기가 자동으로 바뀌어요. 한국어, 일본어, 영어 사용자 모두를 위한 학습 구조예요.' },
    ],
    bottomTitle: '지금 바로 시작해보세요',
    bottomSubtitle: '가입은 1분이면 충분해요.',
    footer: '© 2026 Utago (우타고)',
  },
  ja: {
    login: 'ログイン',
    signup: '無料で始める',
    heroTitle: ['好きな歌で、', '新しい言語を学ぶ'],
    heroSubtitle: '歌詞を追いながら単語・文法・発音を一度に。\n今すぐUtagoを始めてみましょう。',
    heroCta: '無料で始める',
    heroLogin: 'すでにアカウントをお持ちですか？ ログイン',
    popularTitle: '今人気の曲',
    featuresTitle: 'Utagoならではの学習方法',
    features: [
      { icon: 'song', title: '好きな曲からスタート', desc: '歌詞を口ずさみながら自然に外国語を身につけましょう。退屈な教材の代わりに、好きな曲で勉強できます。' },
      { icon: 'grammar', title: '文法までまとめて', desc: '歌詞の中の重要な文法を整理して表示します。単語や発音だけでなく文の構造まで理解できます。' },
      { icon: 'globe', title: '母国語に合わせた発音', desc: '母国語に応じて発音表記が自動的に切り替わります。韓国語・日本語・英語話者すべてに対応した学習構造です。' },
    ],
    bottomTitle: '今すぐ始めましょう',
    bottomSubtitle: '登録は1分もかかりません。',
    footer: '© 2026 Utago (歌語)',
  },
  en: {
    login: 'Log in',
    signup: 'Get started free',
    heroTitle: ['Learn a new language', 'through songs you love'],
    heroSubtitle: 'Follow along with the lyrics and pick up vocabulary, grammar,\nand pronunciation all at once — start with Utago right now.',
    heroCta: 'Get started free',
    heroLogin: 'Already have an account? Log in',
    popularTitle: 'Trending songs',
    featuresTitle: 'The Utago way of learning',
    features: [
      { icon: 'song', title: 'Start with songs you love', desc: 'Pick up a new language naturally by singing along. Study with songs you actually enjoy, not boring textbooks.' },
      { icon: 'grammar', title: 'Grammar, covered too', desc: 'Key grammar points from the lyrics are broken down for you, so you understand sentence structure, not just words.' },
      { icon: 'globe', title: 'Pronunciation for your language', desc: 'Pronunciation guides switch automatically based on your native language — built for Korean, Japanese, and English speakers alike.' },
    ],
    bottomTitle: 'Start learning today',
    bottomSubtitle: 'Signing up takes less than a minute.',
    footer: '© 2026 Utago',
  },
}

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

// 모던한 커스텀 언어 선택 드롭다운 (네이티브 select 대신 직접 구현).
function LangSwitcher({ lang, setLang }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="landing-lang-switcher" ref={rootRef}>
      <button
        type="button"
        className="landing-lang-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M2 12h20"></path>
          <path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"></path>
        </svg>
        <span>{current.label}</span>
        <svg className={`landing-lang-chevron${open ? ' landing-lang-chevron--open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      {open && (
        <ul className="landing-lang-menu" role="listbox">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={l.code === lang}
                className={`landing-lang-option${l.code === lang ? ' landing-lang-option--active' : ''}`}
                onClick={() => {
                  setLang(l.code)
                  setOpen(false)
                }}
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Landing() {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('utago_landing_lang') || 'ko'
    } catch {
      return 'ko'
    }
  })
  const t = TRANSLATIONS[lang]
  const heroRef = useRef(null)

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

  useEffect(() => {
    try {
      localStorage.setItem('utago_landing_lang', lang)
    } catch {
      // localStorage를 못 쓰는 환경이면 그냥 무시 (언어 선택 자체는 계속 동작)
    }
  }, [lang])

  return (
    <div className="landing-page">
      {/* 상단바 */}
      <header className="landing-topbar">
        <div className="landing-topbar-logo">
          <img src="/utago-logo-purple.png" alt="UTAGO" className="landing-logo-img" />
        </div>
        <div className="landing-topbar-actions">
          <LangSwitcher lang={lang} setLang={setLang} />
          <Link to="/login" className="landing-login-btn" onClick={handleBrandNavClick('/login')}>{t.login}</Link>
          <Link to="/signup" className="landing-signup-btn" onClick={handleBrandNavClick('/signup')}>{t.signup}</Link>
        </div>
      </header>

      {/* 히어로 */}
      <section className="landing-hero" ref={heroRef}>
        <div className="landing-hero-circle landing-hero-circle--top" />
        <div className="landing-hero-circle landing-hero-circle--bottom" />

        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            {t.heroTitle[0]}
            <br />
            {t.heroTitle[1]}
          </h1>
          <p className="landing-hero-subtitle">
            {t.heroSubtitle.split('\n').map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
          <div className="landing-hero-actions">
            <Link to="/signup" className="landing-cta-btn" onClick={handleBrandNavClick('/signup')}>{t.heroCta}</Link>
            <Link to="/login" className="landing-hero-login-link" onClick={handleBrandNavClick('/login')}>{t.heroLogin}</Link>
          </div>
        </div>
      </section>

      {/* 지금 인기있는 곡 - 무한 스크롤 마퀴 */}
      <section className="landing-popular">
        <h2 className="landing-popular-title">{t.popularTitle}</h2>
        <Marquee items={POPULAR_SONGS} />
      </section>

      {/* 특징 */}
      <section className="landing-features">
        <h2 className="landing-features-title">{t.featuresTitle}</h2>
        <div className="landing-features-grid">
          {t.features.map((f) => (
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
        <h2 className="landing-bottom-cta-title">{t.bottomTitle}</h2>
        <p className="landing-bottom-cta-subtitle">{t.bottomSubtitle}</p>
        <Link to="/signup" className="landing-cta-btn landing-cta-btn--light" onClick={handleBrandNavClick('/signup')}>{t.heroCta}</Link>
      </section>

      <footer className="landing-footer">
        <span>{t.footer}</span>
      </footer>
    </div>
  )
}
