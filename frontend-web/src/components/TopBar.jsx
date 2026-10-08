import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser, isLoggedIn, logout } from '../api/auth'
import { getMyRole } from '../api/admin'
import { startPageTransition } from '../utils/pageTransition'
import { getLastKnownLandingHeroRect } from '../utils/landingHeroRect'
import LangSwitcher from './LangSwitcher'
import './TopBar.css'

// Login.jsx의 로그인→홈 전환과 정확히 같은 높이 — 로그아웃 전환이 "상단바에서
// 시작해서 다시 상단바 크기로" 자연스럽게 끝나려면 그려지는 크기가 실제
// TopBar.css 높이와 어긋나면 안 된다.
const TOPBAR_HEIGHT = 64

// 홈/곡 추가/곡 학습 등 여러 화면에서 공통으로 쓰는 상단바(원래 Home.jsx 안에만 있던
// 메뉴·로고·검색·알림·프로필 드롭다운을 분리한 것) — 기능은 완전히 동일하게 유지하고,
// showSearch만 꺼서 검색창 없는 버전으로도 쓸 수 있게 했다(검색은 홈 화면에서만 필요).
//
// 로그인 안 한 사용자도 곡 학습 화면(공개 곡)에는 들어올 수 있어서, 그 경우 알림/프로필
// 대신 "로그인" 링크만 보여준다.
export default function TopBar({ showSearch = true, searchValue = '', onSearchChange }) {
  const loggedIn = isLoggedIn()
  const user = getCurrentUser()
  const displayName = user?.nickname ?? user?.email ?? ''
  const avatarInitial = displayName ? displayName.trim().charAt(0).toUpperCase() : '?'

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  // 2026-10-08 추가 — 관리자 계정이면 상단바 메뉴/프로필 드롭다운에 "관리자 페이지" 링크를
  // 보여준다(기존엔 /admin/... 주소를 직접 타이핑해서 들어가야 했음). getCurrentUser()가
  // 들고 있는 로그인 세션 정보엔 role이 없어서, 관리자 화면들과 동일하게 GET
  // /api/users/me/role을 한 번 호출해서 확인한다 — 일반 사용자에겐 그냥 안 보일 뿐이라
  // 실제 접근 제어는 어차피 각 관리자 화면/엔드포인트가 매번 다시 확인한다.
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    if (!loggedIn) return
    getMyRole().then((res) => setIsAdmin(res.role === 'ADMIN')).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 페이지 표시 언어(모국어 설정과는 별개) — 비로그인 랜딩 페이지의 언어 선택과
  // 동일한 저장 방식을 쓰되 키만 다르게 둬서 서로 영향을 주지 않게 한다.
  const [displayLang, setDisplayLang] = useState(() => {
    try {
      return localStorage.getItem('utago_display_lang') || 'ko'
    } catch {
      return 'ko'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('utago_display_lang', displayLang)
    } catch {
      // localStorage를 못 쓰는 환경이면 그냥 무시
    }
  }, [displayLang])

  const sidebarRef = useRef(null)
  const menuBtnRef = useRef(null)
  const profileRef = useRef(null)
  const avatarBtnRef = useRef(null)
  const topbarRef = useRef(null)

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
    closeAll()
    // 실제 상단바(보라색)의 현재 위치/크기에서 시작해서 화면 전체를 채운 뒤,
    // "위로 슬라이드해서 사라지는" 게 아니라 랜딩 페이지의 보라색 히어로 영역
    // (Landing.jsx의 .landing-hero) 크기로 다시 "모여들며" 줄어든다 — 랜딩에서
    // 로그인/가입하기를 누르면 히어로가 커지면서 화면을 채우는 전환의 정확히
    // 반대 방향.
    // (히어로는 화면을 억지로 꽉 채우지 않고 콘텐츠 높이만큼만 차지하므로,
    //  도착 크기를 화면 크기로 어림짐작하지 않고 utils/landingHeroRect.js가
    //  Landing.jsx에서 실측해 기억해둔 실제 크기를 그대로 쓴다. 장식 원 크기/
    //  위치도 'hero' variant로 랜딩 히어로의 진짜 원과 똑같이 맞춰서, 다
    //  줄어들어 페이드아웃되는 순간 진짜 히어로와 이어 붙여도 티가 나지
    //  않게 한다.)
    const rect = topbarRef.current
      ? topbarRef.current.getBoundingClientRect()
      : { top: 0, left: 0, width: window.innerWidth, height: TOPBAR_HEIGHT }

    // "/" 는 로그인 여부에 따라 자동으로 갈라진다(App.jsx의 RootRoute). RootRoute가
    // auth.js의 AUTH_CHANGE_EVENT를 구독해 로그인 상태를 state로 들고 있어서,
    // navigate()만으로도 Landing으로 제대로 갈아끼워진다 — 다만 logout()을 지금 바로
    // 호출하면 (지금 "/"에 있는 경우) RootRoute가 그 즉시 Home→Landing으로 바뀌어버려서,
    // 오버레이가 아직 화면을 다 덮기도 전에 비로그인 화면이 비쳐 보이는 문제가 있었다.
    // 그래서 logout()은 오버레이가 화면 전체를 다 채운 뒤(onReveal, navigate 직전)에야
    // 호출되도록 미뤘다 — 로그인 때 submitting을 전환이 끝날 때까지 들고 있는 것과 같은
    // 이유로, "보이면 안 되는 상태 변화"는 전부 오버레이 뒤에서 일어나야 한다.
    startPageTransition(rect, '/', {
      replace: true,
      variant: 'hero',
      getShrinkRect: getLastKnownLandingHeroRect,
      onReveal: () => logout(),
    })
  }

  return (
    <>
      <div className="home-topbar" ref={topbarRef}>
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

        {showSearch && (
          <label className="home-search">
            <span className="home-search-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a7f6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input
              type="text"
              placeholder="곡, 아티스트 검색"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
          </label>
        )}

        <div className="home-topbar-right">
          {loggedIn ? (
            <>
              <LangSwitcher lang={displayLang} setLang={setDisplayLang} />
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
            </>
          ) : (
            <Link to="/login" className="home-topbar-login">로그인</Link>
          )}
        </div>
      </div>

      {/* 좌측 사이드바 드로어 - 항상 마운트해두고 transform으로만 여닫아야
          왼쪽에서 부드럽게 슬라이드되는 애니메이션이 가능하다. */}
      <div className={`home-sidebar${sidebarOpen ? ' home-sidebar--open' : ''}`} ref={sidebarRef} aria-hidden={!sidebarOpen}>
        <nav aria-label="주요 메뉴" className="home-sidebar-nav">
          <a href="/" className="home-sidebar-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b5c46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5 12 3l9 6.5"></path>
              <path d="M5 10v10h14V10"></path>
            </svg>
            <span>홈</span>
          </a>
          <Link to="/wordbook" className="home-sidebar-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b5c46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"></path>
            </svg>
            <span>단어장</span>
          </Link>
          <a href="#grammar" className="home-sidebar-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b5c46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h10M4 18h7"></path>
            </svg>
            <span>문법</span>
          </a>
          <Link to="/mypage" className="home-sidebar-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b5c46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path>
            </svg>
            <span>마이페이지</span>
          </Link>
          {isAdmin && (
            <Link to="/admin/featured-songs" className="home-sidebar-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b5c46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7l-9-5Z"></path>
              </svg>
              <span>관리자 페이지</span>
            </Link>
          )}
        </nav>

        <div className="home-sidebar-spacer" />

        {/* 다크모드 토글/로그아웃은 프로필 드롭다운에 이미 있어 여기서는 뺐다
            (2026-10-01, 마이페이지 기획 피드백 — 중복 제거). 비로그인 사용자용
            로그인 링크만 예외적으로 유지한다. */}
        {!loggedIn && (
          <>
            <div className="home-sidebar-divider" />
            <Link to="/login" className="home-sidebar-link home-sidebar-logout">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6b5c46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10 17 15 12 10 7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
              <span>로그인</span>
            </Link>
          </>
        )}
      </div>

      {/* 프로필 드롭다운 */}
      {loggedIn && profileOpen && (
        <div className="home-profile-dropdown" ref={profileRef}>
          <div className="home-profile-header">
            <div className="home-profile-avatar">{avatarInitial}</div>
            <div className="home-profile-info">
              <span className="home-profile-name">{displayName}</span>
              <span className="home-profile-email">{user?.email}</span>
            </div>
          </div>
          <div className="home-profile-divider" />

          <Link to="/mypage" onClick={closeAll} className="home-profile-item">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5b5346" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path>
            </svg>
            <span>마이페이지</span>
          </Link>
          {isAdmin && (
            <Link to="/admin/featured-songs" onClick={closeAll} className="home-profile-item">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5b5346" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7l-9-5Z"></path>
              </svg>
              <span>관리자 페이지</span>
            </Link>
          )}
          <a href="#profile-settings" className="home-profile-item">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5b5346" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16M4 12h16M4 19h9"></path>
            </svg>
            <span>프로필 설정</span>
          </a>
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
    </>
  )
}
