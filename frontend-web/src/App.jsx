import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import Landing from './pages/Landing'
import SongLearn from './pages/SongLearn'
import SongSync from './pages/SongSync'
import SongEdit from './pages/SongEdit'
import AddSong from './pages/AddSong'
import AdminTranslations from './pages/AdminTranslations'
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
        {/* 로그인은 필수, ADMIN 여부는 페이지 자체가 /api/users/me/role로 다시 확인함 */}
        <Route
          path="/admin/translations"
          element={(
            <RequireAuth>
              <AdminTranslations />
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
