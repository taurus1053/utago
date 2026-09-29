// 로그인/인증 관련 API 호출 + 토큰 저장.
import { apiGet, apiPost, TOKEN_KEY } from './client'

const USER_KEY = 'utago_user'

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
}
