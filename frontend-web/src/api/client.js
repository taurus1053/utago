// 백엔드 API 호출을 위한 아주 작은 공용 클라이언트.
// 나중에 곡 목록, 단어장 등 실제 API가 늘어나면 이 파일에 함수를 추가하세요.
import i18n from '../i18n'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

// 로그인 토큰 로컬스토리지 키. auth.js 도 이 값을 그대로 가져다 쓴다(중복 정의 방지).
export const TOKEN_KEY = 'utago_token'

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

// 백엔드 GlobalExceptionHandler 가 내려주는 에러 모양을 감싸는 커스텀 에러.
// - IllegalStateException 계열: { message: "..." }
// - @Valid 검증 실패: { 필드명: "에러메시지", ... } (message 키 없음)
export class ApiError extends Error {
  constructor(status, body) {
    const fallback = i18n.t('errors.generic')
    const message = body && typeof body === 'object' && body.message ? body.message : fallback
    super(message)
    this.status = status
    this.body = body
    // message 키가 없으면 필드별 검증 에러 맵으로 간주.
    this.fieldErrors = body && typeof body === 'object' && !body.message ? body : null
  }
}

async function request(path, options = {}) {
  const token = getStoredToken()
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // 로그인 상태면 모든 요청에 토큰을 실어 보낸다 — 이게 빠져있으면 로그인 필요한
      // 엔드포인트(POST /api/songs, GET /api/songs/my 등)는 항상 401이 난다.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    let body = null
    try {
      body = await res.json()
    } catch {
      // 본문이 JSON이 아닌 경우(예: 500) 무시하고 기본 메시지 사용.
    }
    throw new ApiError(res.status, body)
  }

  // 204는 물론이고, 백엔드가 ResponseEntity.ok().build() 로 본문 없이 200을 내려주는
  // 엔드포인트(request-signup-code, verify-signup-code 등)도 있어서 상태코드만으로는
  // 판단할 수 없다. 본문이 비어있으면 JSON 파싱을 시도하지 않고 그냥 null 반환.
  if (res.status === 204) {
    return null
  }

  const text = await res.text()
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function apiGet(path) {
  return request(path, { method: 'GET' })
}

export function apiPost(path, data) {
  return request(path, {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  })
}

export function apiPut(path, data) {
  return request(path, {
    method: 'PUT',
    body: JSON.stringify(data ?? {}),
  })
}

export function apiDelete(path) {
  return request(path, { method: 'DELETE' })
}

export function apiPatch(path, data) {
  return request(path, {
    method: 'PATCH',
    body: JSON.stringify(data ?? {}),
  })
}

export async function getHealth() {
  return apiGet('/api/health')
}
