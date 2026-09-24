import { useEffect, useRef, useState } from 'react'
import { getCurrentUser, logout } from '../api/auth'
import { useNavigate } from 'react-router-dom'
import './Home.css'

// 디자인 목업(Main.dc.html)을 기반으로 한 실제 홈 화면.
// 곡 관련 데이터(이어서 학습하기, 인기 급상승, 내 곡, 전체 곡 등)는
// 아직 백엔드 곡 API가 없어서 임시 목업 데이터를 사용합니다.
// 실제 곡 API가 생기면 이 파일의 MOCK_* 상수들을 API 호출로 교체하면 됩니다.

const CONTINUE_SONG = {
  title: '踊り子',
  artist: 'Vaundy',
  progressPercent: 35,
  progressLabel: '12 / 34줄',
}
const CONTINUE_LINES = [
  '夜の帳が下りる頃 街の灯りが揺れる',
  '誰にも言えない秘密を抱えて 歩き出す',
  '風が頬をかすめてく その先に何がある',
  '迷いながらも進んでく それが僕の生き方',
  '遠くで鳴る足音が 少しずつ近づいてくる',
]

const REVIEW_SONG = {
  title: 'アイドル',
  artist: 'YOASOBI',
  completedLabel: '완주 3회',
  lastLabel: '5일 전',
}
const REVIEW_LINES = [
  '夜道を歩きながら 君のことを思う',
  'この歌がずっと 続けばいいのに',
  'そんな願いも 胸にしまって',
  '明日もまた同じ景色を 歩いていくんだろう',
  '小さな声で歌う メロディーが響く',
]

const POPULAR_SONGS = [
  { title: 'アイドル', artist: 'YOASOBI', color: '#f3e2d8' },
  { title: '봄날', artist: '방탄소년단', color: '#eef1e6' },
  { title: '怪物', artist: 'YOASOBI', color: '#f3e2d8' },
  { title: 'Dynamite', artist: 'BTS', color: '#e7edf3' },
]

const GENRES = [
  { label: 'J-POP', bg: 'linear-gradient(135deg,#f3e2d8,#e9c3ae)', color: '#7a3417' },
  { label: 'K-POP', bg: 'linear-gradient(135deg,#eef1e6,#d3ddc4)', color: '#445236' },
  { label: 'POP', bg: 'linear-gradient(135deg,#e7edf3,#c6d6e6)', color: '#2c4a68' },
  { label: '발라드', bg: 'linear-gradient(135deg,#efe6f5,#d9c3ea)', color: '#5c3a75' },
  { label: '초급', bg: 'linear-gradient(135deg,#fdeee0,#f6cfa8)', color: '#8a4a10' },
  { label: '고급', bg: '#201a14', color: '#ffffff' },
]

const LANG_BADGE = {
  JA: { bg: '#f3e2d8', color: '#b0512f' },
  KO: { bg: '#eef1e6', color: '#5e7150' },
  EN: { bg: '#e7edf3', color: '#3f6488' },
}

const MY_SONGS = [
  { title: 'アイドル', artist: 'YOASOBI', lang: 'JA', color: '#f3e2d8' },
  { title: '봄날', artist: '방탄소년단', lang: 'KO', color: '#eef1e6' },
  { title: 'Shape of You', artist: 'Ed Sheeran', lang: 'EN', color: '#e7edf3' },
]

const ALL_SONGS = [
  { title: '怪物', artist: 'YOASOBI', lang: 'JA', color: '#f3e2d8' },
  { title: 'Dynamite', artist: 'BTS', lang: 'EN', color: '#eef1e6' },
  { title: '밤편지', artist: '아이유', lang: 'KO', color: '#eef1e6' },
]

const LANG_FILTERS = ['전체', '일본어', '한국어', '영어']

const ROW_PX = 23
const SCROLL_MS = 480

function useLyricTicker(lines, intervalMs) {
  const [base, setBase] = useState(0)
  const [offset, setOffset] = useState(0)
  const [transitionOn, setTransitionOn] = useState(false)

  useEffect(() => {
    const tick = setInterval(() => {
      setTransitionOn(true)
      setOffset(1)
      setTimeout(() => {
        setTransitionOn(false)
        setOffset(0)
        setBase((b) => (b + 1) % lines.length)
      }, SCROLL_MS)
    }, intervalMs)
    return () => clearInterval(tick)
  }, [lines, intervalMs])

  const wrap = (i) => lines[((i % lines.length) + lines.length) % lines.length]

  return {
    row0: wrap(base - 1),
    row1: wrap(base),
    row2: wrap(base + 1),
    row3: wrap(base + 2),
    offsetPx: `-${offset * ROW_PX}px`,
    transitionCss: transitionOn ? 'transform 0.48s cubic-bezier(0.22,0.61,0.36,1)' : 'none',
    colorTransitionCss: transitionOn ? 'color 0.48s cubic-bezier(0.22,0.61,0.36,1)' : 'none',
    row1Color: offset === 0 ? '#ffffff' : 'rgba(255,255,255,0.55)',
    row2Color: offset === 0 ? 'rgba(255,255,255,0.55)' : '#ffffff',
  }
}

export default function Home() {
  const navigate = useNavigate()
  const user = getCurrentUser()
  const displayName = user?.nickname ?? user?.email ?? ''
  const avatarInitial = displayName ? displayName.trim().charAt(0).toUpperCase() : '?'

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const hasReviewSong = true

  const continueTicker = useLyricTicker(CONTINUE_LINES, 2600)
  const reviewTicker = useLyricTicker(REVIEW_LINES, 3000)

  const rootRef = useRef(null)
  const sidebarRef = useRef(null)
  const menuBtnRef = useRef(null)
  const profileRef = useRef(null)
  const avatarBtnRef = useRef(null)

  function toggleSidebar() {
    setSidebarOpen((v) => !v)
    setProfileOpen(false)
  }
  function toggleProfile() {
    setProfileOpen((v) => !v)
    setSidebarOpen(false)
  }
  function closeAll() {
    setSidebarOpen(false)
    setProfileOpen(false)
  }

  // 배경을 어둡게 가리는 스크림 없이, 바깥 영역을 클릭하면
  // 사이드바/프로필 드롭다운이 닫히도록 한다.
  useEffect(() => {
    if (!sidebarOpen && !profileOpen) return
    function handleClickOutside(e) {
      const t = e.target
      const insideSidebar = sidebarRef.current && sidebarRef.current.contains(t)
      const insideMenuBtn = menuBtnRef.current && menuBtnRef.current.contains(t)
      const insideProfile = profileRef.current && profileRef.current.contains(t)
      const insideAvatarBtn = avatarBtnRef.current && avatarBtnRef.current.contains(t)
      if (!insideSidebar && !insideMenuBtn && !insideProfile && !insideAvatarBtn) {
        closeAll()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [sidebarOpen, profileOpen])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="home-page" ref={rootRef}>
      {/* 상단바 */}
      <div className="home-topbar">
        <div className="home-topbar-left">
          <button aria-label="메뉴 열기" onClick={toggleSidebar} className="home-icon-btn" ref={menuBtnRef}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <a href="/" className="home-logo-link">
            <img src="/utago-logo.png" alt="UTAGO" className="home-logo" />
          </a>
        </div>

        <label className="home-search">
          <span className="home-search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a7f6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input type="text" placeholder="곡, 아티스트 검색" />
        </label>

        <div className="home-topbar-right">
          <button aria-label="알림" className="home-icon-btn home-bell-btn">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span className="home-bell-badge">3</span>
          </button>
          <button aria-label="프로필 메뉴 열기" onClick={toggleProfile} className="home-avatar-btn" ref={avatarBtnRef}>
            {avatarInitial}
          </button>
        </div>
      </div>

      {/* 좌측 사이드바 드로어 - 항상 마운트해두고 transform으로만 여닫아야
          왼쪽에서 부드럽게 슬라이드되는 애니메이션이 가능하다. */}
      <div className={`home-sidebar${sidebarOpen ? ' home-sidebar--open' : ''}`} ref={sidebarRef} aria-hidden={!sidebarOpen}>
          <nav aria-label="주요 메뉴" className="home-sidebar-nav">
            <a href="#home" aria-current="page" className="home-sidebar-link home-sidebar-link--active" style={{ color: '#ffffff' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5 12 3l9 6.5"></path>
                <path d="M5 10v10h14V10"></path>
              </svg>
              <span style={{ color: '#ffffff' }}>홈</span>
            </a>
            <a href="#wordbook" className="home-sidebar-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b5c46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"></path>
              </svg>
              <span>단어장</span>
            </a>
            <a href="#grammar" className="home-sidebar-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b5c46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h10M4 18h7"></path>
              </svg>
              <span>문법</span>
            </a>
            <a href="#mypage" className="home-sidebar-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b5c46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"></circle>
                <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path>
              </svg>
              <span>마이페이지</span>
            </a>
          </nav>

          <div className="home-sidebar-spacer" />

          <div className="home-sidebar-divider" />

          <button className="home-sidebar-darkmode">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6b5c46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"></path>
            </svg>
            <span>다크 모드</span>
          </button>
          <a href="#logout" onClick={(e) => { e.preventDefault(); handleLogout() }} className="home-sidebar-link home-sidebar-logout">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6b5c46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>로그아웃</span>
          </a>
      </div>

      {/* 프로필 드롭다운 */}
      {profileOpen && (
        <div className="home-profile-dropdown" ref={profileRef}>
          <div className="home-profile-header">
            <div className="home-profile-avatar">{avatarInitial}</div>
            <div className="home-profile-info">
              <span className="home-profile-name">{displayName}</span>
              <span className="home-profile-email">{user?.email}</span>
            </div>
          </div>
          <div className="home-profile-divider" />

          <a href="#profile-settings" className="home-profile-item">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5b5346" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path>
            </svg>
            <span>프로필 설정</span>
          </a>
          <a href="#lang-settings" className="home-profile-item">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5b5346" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16M4 12h16M4 19h9"></path>
            </svg>
            <span>학습 언어 설정</span>
          </a>
          <div className="home-profile-toggle-row">
            <div className="home-profile-item-left">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5b5346" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"></path>
              </svg>
              <span>다크 모드</span>
            </div>
            <div className="home-toggle-track">
              <div className="home-toggle-knob" />
            </div>
          </div>
          <a href="#display-lang" className="home-profile-item home-profile-item--between">
            <div className="home-profile-item-left">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5b5346" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M2 12h20"></path>
                <path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"></path>
              </svg>
              <span>표시 언어</span>
            </div>
            <span className="home-profile-item-value">한국어</span>
          </a>
          <a href="#support" className="home-profile-item">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5b5346" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>고객센터</span>
          </a>

          <div className="home-profile-divider" />
          <a href="#logout" onClick={(e) => { e.preventDefault(); handleLogout() }} className="home-profile-item home-profile-item--danger">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#b0512f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>로그아웃</span>
          </a>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="home-content">

        {/* 이어서 학습하기 · 복습하기 */}
        <div className="home-hero-row">
          <a href="#continue" className="home-hero-card home-hero-card--continue">
            <div className="home-hero-bg" style={{ background: '#221533' }} />
            <div className="home-hero-overlay" />
            <div className="home-hero-top">
              <div className="home-hero-cover" style={{ background: '#3a2650' }} />
              <div className="home-hero-info">
                <div className="home-hero-eyebrow">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  <span>이어서 학습하기</span>
                </div>
                <div className="home-hero-title">{CONTINUE_SONG.title}</div>
                <div className="home-hero-artist">{CONTINUE_SONG.artist}</div>
                <div className="home-hero-progress-row">
                  <div className="home-hero-progress-track">
                    <div className="home-hero-progress-fill" style={{ width: `${CONTINUE_SONG.progressPercent}%` }} />
                  </div>
                  <span className="home-hero-progress-label">{CONTINUE_SONG.progressLabel}</span>
                </div>
              </div>
            </div>

            <div className="home-hero-ticker">
              <div className="home-hero-ticker-highlight" style={{ background: 'rgba(255,157,122,0.7)' }} />
              <div className="home-hero-ticker-rows" style={{ transform: `translateY(${continueTicker.offsetPx})`, transition: continueTicker.transitionCss }}>
                <div className="home-hero-ticker-row"><span style={{ color: 'rgba(255,255,255,0.55)', transition: continueTicker.colorTransitionCss }}>{continueTicker.row0}</span></div>
                <div className="home-hero-ticker-row"><span style={{ color: continueTicker.row1Color, fontWeight: 700, transition: continueTicker.colorTransitionCss }}>{continueTicker.row1}</span></div>
                <div className="home-hero-ticker-row"><span style={{ color: continueTicker.row2Color, fontWeight: 700, transition: continueTicker.colorTransitionCss }}>{continueTicker.row2}</span></div>
                <div className="home-hero-ticker-row"><span style={{ color: 'rgba(255,255,255,0.55)', transition: continueTicker.colorTransitionCss }}>{continueTicker.row3}</span></div>
              </div>
            </div>
          </a>

          <div className="home-hero-card-slot">
            {hasReviewSong ? (
              <a href="#review" className="home-hero-card home-hero-card--review">
                <div className="home-hero-bg" style={{ background: '#131a33' }} />
                <div className="home-hero-overlay" style={{ background: 'rgba(10,14,28,0.4)' }} />
                <div className="home-hero-top">
                  <div className="home-hero-cover" style={{ background: '#22304f' }} />
                  <div className="home-hero-info">
                    <div className="home-hero-eyebrow">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
                        <polyline points="21 3 21 9 15 9"></polyline>
                      </svg>
                      <span>복습하기</span>
                    </div>
                    <div className="home-hero-title">{REVIEW_SONG.title}</div>
                    <div className="home-hero-artist">{REVIEW_SONG.artist}</div>
                    <div className="home-hero-progress-row">
                      <span className="home-hero-pill">{REVIEW_SONG.completedLabel}</span>
                      <span className="home-hero-progress-label">{REVIEW_SONG.lastLabel}</span>
                    </div>
                  </div>
                </div>

                <div className="home-hero-ticker">
                  <div className="home-hero-ticker-highlight" style={{ background: 'rgba(111,195,255,0.7)' }} />
                  <div className="home-hero-ticker-rows" style={{ transform: `translateY(${reviewTicker.offsetPx})`, transition: reviewTicker.transitionCss }}>
                    <div className="home-hero-ticker-row"><span style={{ color: 'rgba(255,255,255,0.55)', transition: reviewTicker.colorTransitionCss }}>{reviewTicker.row0}</span></div>
                    <div className="home-hero-ticker-row"><span style={{ color: reviewTicker.row1Color, fontWeight: 700, transition: reviewTicker.colorTransitionCss }}>{reviewTicker.row1}</span></div>
                    <div className="home-hero-ticker-row"><span style={{ color: reviewTicker.row2Color, fontWeight: 700, transition: reviewTicker.colorTransitionCss }}>{reviewTicker.row2}</span></div>
                    <div className="home-hero-ticker-row"><span style={{ color: 'rgba(255,255,255,0.55)', transition: reviewTicker.colorTransitionCss }}>{reviewTicker.row3}</span></div>
                  </div>
                </div>
              </a>
            ) : (
              <div className="home-hero-empty">
                <div className="home-hero-empty-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a89c86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
                    <polyline points="21 3 21 9 15 9"></polyline>
                  </svg>
                </div>
                <div className="home-hero-empty-text">
                  <span className="home-hero-empty-title">아직 복습할 곡이 없어요</span>
                  <span className="home-hero-empty-sub">노래를 하나 완주하면<br />여기에 복습 목록이 생겨요</span>
                </div>
                <a href="#browse" className="home-hero-empty-btn">곡 둘러보기</a>
              </div>
            )}
          </div>
        </div>

        {/* 언어 필터 */}
        <div className="home-lang-filters">
          {LANG_FILTERS.map((label, i) => (
            <button key={label} className={`home-lang-filter${i === 0 ? ' home-lang-filter--active' : ''}`}>
              {label}
            </button>
          ))}
        </div>

        {/* 인기 급상승 */}
        <section className="home-section">
          <h2 className="home-section-title">인기 급상승</h2>
          <div className="home-popular-grid">
            {POPULAR_SONGS.map((song, i) => (
              <div key={song.title} className="home-popular-card">
                <span className="home-popular-rank">{i + 1}</span>
                <div className="home-popular-cover" style={{ background: song.color }} />
                <div className="home-popular-meta">
                  <div className="home-popular-title">{song.title}</div>
                  <div className="home-popular-artist">{song.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 장르·난이도로 둘러보기 */}
        <section className="home-section">
          <h2 className="home-section-title">장르 · 난이도로 둘러보기</h2>
          <div className="home-genre-grid">
            {GENRES.map((g) => (
              <div key={g.label} className="home-genre-chip" style={{ background: g.bg, color: g.color }}>
                {g.label}
              </div>
            ))}
          </div>
        </section>

        {/* 내 곡 */}
        <section className="home-section">
          <div className="home-section-header">
            <h2 className="home-section-title">내 곡</h2>
            <span className="home-section-more">더보기</span>
          </div>
          <div className="home-song-grid">
            {MY_SONGS.map((song) => (
              <a key={song.title} href="#song" className="home-song-card">
                <div className="home-song-cover" style={{ background: song.color }} />
                <div className="home-song-meta">
                  <span className="home-song-title">{song.title}</span>
                  <span className="home-song-artist">{song.artist}</span>
                </div>
                <span className="home-song-badge" style={{ background: LANG_BADGE[song.lang].bg, color: LANG_BADGE[song.lang].color }}>
                  {song.lang}
                </span>
              </a>
            ))}
          </div>
        </section>

        {/* 전체 곡 */}
        <section className="home-section">
          <div className="home-section-header">
            <h2 className="home-section-title">전체 곡</h2>
            <span className="home-section-count">{ALL_SONGS.length}곡</span>
          </div>
          <div className="home-song-grid">
            {ALL_SONGS.map((song) => (
              <a key={song.title} href="#song" className="home-song-card">
                <div className="home-song-cover" style={{ background: song.color }} />
                <div className="home-song-meta">
                  <span className="home-song-title">{song.title}</span>
                  <span className="home-song-artist">{song.artist}</span>
                </div>
                <span className="home-song-badge" style={{ background: LANG_BADGE[song.lang].bg, color: LANG_BADGE[song.lang].color }}>
                  {song.lang}
                </span>
              </a>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
