import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCurrentUser, isLoggedIn, logout } from '../api/auth'
import LangSwitcher from './LangSwitcher'
import './TopBar.css'

// 홈/곡 추가/곡 학습 등 여러 화면에서 공통으로 쓰는 상단바(원래 Home.jsx 안에만 있던
// 메뉴·로고·검색·알림·프로필 드롭다운을 분리한 것) — 기능은 완전히 동일하게 유지하고,
// showSearch만 꺼서 검색창 없는 버전으로도 쓸 수 있게 했다(검색은 홈 화면에서만 필요).
//
// 로그인 안 한 사용자도 곡 학습 화면(공개 곡)에는 들어올 수 있어서, 그 경우 알림/프로필
// 대신 "로그인" 링크만 보여준다.
export default function TopBar({ showSearch = true, searchValue = '', onSearchChange }) {
  const navigate = useNavigate()
  const loggedIn = isLoggedIn()
  const user = getCurrentUser()
  const displayName = user?.nickname ?? user?.email ?? ''
  const avatarInitial = displayName ? displayName.trim().charAt(0).toUpperCase() : '?'

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

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
    // "/" 는 로그인 여부에 따라 자동으로 갈라진다(App.jsx의 RootRoute) — 로그아웃 직후엔
    // 비로그인 상태라 랜딩 페이지가 보인다. 로그인 화면으로 곧장 보내지 않는다.
    navigate('/', { replace: true })
  }

  return (
    <>
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
        {loggedIn ? (
          <a href="#logout" onClick={(e) => { e.preventDefault(); handleLogout() }} className="home-sidebar-link home-sidebar-logout">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6b5c46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>로그아웃</span>
          </a>
        ) : (
          <Link to="/login" className="home-sidebar-link home-sidebar-logout">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6b5c46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
            <span>로그인</span>
          </Link>
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
    </>
  )
}
