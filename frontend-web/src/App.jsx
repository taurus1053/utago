import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import Landing from './pages/Landing'
import SongLearn from './pages/SongLearn'
import SongSync from './pages/SongSync'
import SongEdit from './pages/SongEdit'
import Wordbook from './pages/Wordbook'
import MyPage from './pages/MyPage'
import TitlesPage from './pages/TitlesPage'
import Friends from './pages/Friends'
import BoardList from './pages/BoardList'
import BoardWrite from './pages/BoardWrite'
import BoardDetail from './pages/BoardDetail'
import AddSong from './pages/AddSong'
import AdminTranslations from './pages/AdminTranslations'
import AdminSongs from './pages/AdminSongs'
import AdminFeaturedSongs from './pages/AdminFeaturedSongs'
import AdminReports from './pages/AdminReports'
import AdminAnnouncements from './pages/AdminAnnouncements'
import Credits from './pages/Credits'
import PageTransitionOverlay from './components/PageTransitionOverlay'
import RequireAuth from './RequireAuth'
import { isLoggedIn, AUTH_CHANGE_EVENT } from './api/auth'

// "/" 는 로그인 여부에 따라 다른 화면을 보여준다.
// - 로그인 상태: 홈 화면
// - 비로그인 상태: 가입/로그인을 유도하는 랜딩 페이지 (넷플릭스/쿠팡플레이 스타일)
//
// 로그인 여부를 매 렌더마다 다시 읽는 게 아니라 state로 들고 있다가, auth.js가
// login()/logout() 시점에 쏘는 AUTH_CHANGE_EVENT를 구독해서 갱신한다 — 로그아웃
// 애니메이션이 로그인 때처럼 페이지 새로고침 없는 SPA navigate()만으로도
// RootRoute를 제대로 다시 그리게 하기 위함(예전엔 이게 안 돼서 로그아웃 시
// window.location.assign('/')로 통째로 새로고침했었다).
function RootRoute() {
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn())

  useEffect(() => {
    function handleAuthChange() {
      setLoggedIn(isLoggedIn())
    }
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange)
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange)
  }, [])

  return loggedIn ? <Home /> : <Landing />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<RootRoute />} />
        {/* 오픈 데이터/라이브러리 출처 표기 — JMdict(CC BY-SA 3.0) 등. 로그인 불필요 */}
        <Route path="/credits" element={<Credits />} />
        <Route path="/songs/new" element={<AddSong />} />
        <Route path="/songs/:id" element={<SongLearn />} />
        {/* 가사 싱크(탭싱크) 편집 — 곡을 등록한 본인만 저장 가능(서버가 확인), 로그인은 필수 */}
        <Route
          path="/songs/:id/sync"
          element={(
            <RequireAuth>
              <SongSync />
            </RequireAuth>
          )}
        />
        {/* 가사 내용(원문/의역) 편집 — 곡을 등록한 본인만 저장 가능(서버가 확인), 로그인은 필수 */}
        <Route
          path="/songs/:id/edit"
          element={(
            <RequireAuth>
              <SongEdit />
            </RequireAuth>
          )}
        />
        {/* 단어장 — 왼쪽 사이드바(목록) + 오른쪽 본문(단어 목록·플래시카드 복습)을
            한 화면에서 보여주는 위젯. /wordbook, /wordbook/:id 둘 다 같은 컴포넌트가
            그리고, 내부에서 사이드바로 단어장을 바꾸면 URL만 바뀐다. 로그인 필수. */}
        <Route
          path="/wordbook"
          element={(
            <RequireAuth>
              <Wordbook />
            </RequireAuth>
          )}
        />
        <Route
          path="/wordbook/:id"
          element={(
            <RequireAuth>
              <Wordbook />
            </RequireAuth>
          )}
        />
        {/* 마이페이지 — 프로필/내 단어장/내가 올린 글/저장한 글(claude/소셜_마이페이지_기획.md 5번). 로그인 필수 */}
        <Route
          path="/mypage"
          element={(
            <RequireAuth>
              <MyPage />
            </RequireAuth>
          )}
        />
        {/* 칭호 전체 페이지 — 마이페이지 "칭호" 카드의 "더보기"로 들어옴. 여기서만
            대표 칭호를 설정(착용)할 수 있다(claude/소셜_마이페이지_기획.md 15-6번). 로그인 필수 */}
        <Route
          path="/mypage/titles"
          element={(
            <RequireAuth>
              <TitlesPage />
            </RequireAuth>
          )}
        />
        {/* 친구 — 검색/요청/수락·거절/내 친구 목록을 한 화면에서 처리(claude/소셜_마이페이지_기획.md
            4번/18번). 마이페이지 사이드바 "+ 추가"가 여기로 연결된다. 로그인 필수 */}
        <Route
          path="/friends"
          element={(
            <RequireAuth>
              <Friends />
            </RequireAuth>
          )}
        />
        {/* "단어장 둘러보기" 게시판 — /board(목록), /board/new(글쓰기), /board/:id(상세).
            전부 로그인 필수(백엔드 SecurityConfig가 전역으로 로그인을 요구함). */}
        <Route
          path="/board"
          element={(
            <RequireAuth>
              <BoardList />
            </RequireAuth>
          )}
        />
        <Route
          path="/board/new"
          element={(
            <RequireAuth>
              <BoardWrite />
            </RequireAuth>
          )}
        />
        <Route
          path="/board/:id"
          element={(
            <RequireAuth>
              <BoardDetail />
            </RequireAuth>
          )}
        />
        {/* 로그인은 필수, ADMIN 여부는 페이지 자체가 /api/users/me/role로 다시 확인함 */}
        <Route
          path="/admin/translations"
          element={(
            <RequireAuth>
              <AdminTranslations />
            </RequireAuth>
          )}
        />
        {/* AI 학습곡(멜로디·보컬·가사까지 AI로 제작한 곡) 등록 — 로그인은 필수,
            ADMIN 여부는 페이지 자체가 /api/users/me/role로 다시 확인함 */}
        <Route
          path="/admin/songs"
          element={(
            <RequireAuth>
              <AdminSongs />
            </RequireAuth>
          )}
        />
        {/* 홈 화면 "오늘의 추천곡" 후보 곡 지정/해제 — 로그인은 필수, ADMIN 여부는
            페이지 자체가 /api/users/me/role로 다시 확인함 */}
        <Route
          path="/admin/featured-songs"
          element={(
            <RequireAuth>
              <AdminFeaturedSongs />
            </RequireAuth>
          )}
        />
        {/* 게시판 신고 처리 — 로그인은 필수, ADMIN 여부는 페이지 자체가
            /api/users/me/role로 다시 확인함(claude/소셜_마이페이지_기획.md 23번) */}
        <Route
          path="/admin/reports"
          element={(
            <RequireAuth>
              <AdminReports />
            </RequireAuth>
          )}
        />
        {/* 운영진 공지 발송 — 로그인은 필수, ADMIN 여부는 페이지 자체가
            /api/users/me/role로 다시 확인함(claude/소셜_마이페이지_기획.md 24번) */}
        <Route
          path="/admin/announcements"
          element={(
            <RequireAuth>
              <AdminAnnouncements />
            </RequireAuth>
          )}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <PageTransitionOverlay />
    </BrowserRouter>
  )
}

export default App
