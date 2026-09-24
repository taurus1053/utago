import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import Landing from './pages/Landing'
import PageTransitionOverlay from './components/PageTransitionOverlay'
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <PageTransitionOverlay />
    </BrowserRouter>
  )
}

export default App
