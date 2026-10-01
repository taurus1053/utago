import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import Landing from './pages/Landing'
import SongLearn from './pages/SongLearn'
import SongSync from './pages/SongSync'
import SongEdit from './pages/SongEdit'
import Wordbook from './pages/Wordbook'
import AddSong from './pages/AddSong'
import AdminTranslations from './pages/AdminTranslations'
import AdminSongs from './pages/AdminSongs'
import AdminFeaturedSongs from './pages/AdminFeaturedSongs'
import PageTransitionOverlay from './components/PageTransitionOverlay'
import RequireAuth from './RequireAuth'
import { isLoggedIn } from './api/auth'

// "/" 는 로그인 여부에 따라 다른 화면을 보여준다.
// - 로그인 상태: 홈 화면
// - 비로그인 상태: 가입/로그인을 유도하는 랜딩 페이지 (넷플릭스/쿠팡플레이 스타일)
function RootRoute() {
  return isLoggedIn() ? <Home /> : <Landing />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<RootRoute />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <PageTransitionOverlay />
    </BrowserRouter>
  )
}

export default App
