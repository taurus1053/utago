// 로그인/인증 관련 API 호출 + 토큰 저장.
import { apiGet, apiPost, TOKEN_KEY } from './client'

const USER_KEY = 'utago_user'

// 로그인/로그아웃으로 인증 상태가 바뀔 때마다 쏘는 커스텀 이벤트.
// App.jsx의 RootRoute("/"가 로그인 여부로 Home/Landing을 가르는 부분)가 이걸
// 구독해서, 페이지를 통째로 새로고침하지 않고도 즉시 재평가할 수 있게 한다
// (로그아웃 전환 애니메이션을 로그인 때와 똑같이 SPA navigate()로 재사용하기 위함).
export const AUTH_CHANGE_EVENT = 'utago-auth-changed'

function notifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}

// POST /api/auth/login -> { token, userId, email, nickname }
export async function login(email, password) {
  const auth = await apiPost('/api/auth/login', { email, password })
  saveSession(auth)
  return auth
}

// 회원가입 1단계: 이메일로 인증코드 발송 (계정은 아직 만들어지지 않음).
export async function requestSignupCode(email) {
  return apiPost('/api/auth/request-signup-code', { email })
}

// 회원가입 1단계: 인증코드 확인. 통과해야 signup() 을 호출할 수 있음.
export async function verifySignupCode(email, code) {
  return apiPost('/api/auth/verify-signup-code', { email, code })
}

// 회원가입 2단계: 이메일 인증이 끝난 뒤 나머지 정보로 계정 생성.
// -> { userId, email, message } (토큰은 내려주지 않으므로 이후 별도로 로그인 필요)
export async function signup({ email, password, nickname, nativeLang, birthDate }) {
  return apiPost('/api/auth/signup', { email, password, nickname, nativeLang, birthDate })
}

// -> { nickname, available }
export async function checkNickname(nickname) {
  return apiGet(`/api/auth/check-nickname?nickname=${encodeURIComponent(nickname)}`)
}

function saveSession(auth) {
  localStorage.setItem(TOKEN_KEY, auth.token)
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({ userId: auth.userId, email: auth.email, nickname: auth.nickname }),
  )
  notifyAuthChange()
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getCurrentUser() {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function isLoggedIn() {
  return Boolean(getToken())
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  notifyAuthChange()
}
