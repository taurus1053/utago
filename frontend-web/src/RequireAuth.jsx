import { Navigate, useLocation } from 'react-router-dom'
import { isLoggedIn } from './api/auth'

// 로그인해야만 들어갈 수 있는 라우트를 감싸는 가드.
// 토큰이 없으면 /login 으로 보내고, 로그인 후 원래 가려던 곳으로 돌아올 수 있게
// 현재 위치를 state.from 으로 함께 넘긴다.
export default function RequireAuth({ children }) {
  const location = useLocation()

  if (!isLoggedIn()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
