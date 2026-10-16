// 백엔드 API 호출을 위한 아주 작은 공용 클라이언트.
// 나중에 곡 목록, 단어장 등 실제 API가 늘어나면 이 파일에 함수를 추가하세요.
import i18n from '../i18n'
import { formatDate } from '../i18n/format'

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
// - IllegalStateException 계열: { message: "..." }. 다국어용 ApiException이면 { message, code, params }가
//   같이 와서, code로 현재 표시 언어의 문구(errors.json "api.<code>")를 찾아 쓴다. 번역이 없으면
//   서버가 준 message(한국어)를 그대로 쓴다.
// - @Valid 검증 실패: { 필드명: "에러메시지", ... } (message 키 없음)
// 서버가 준 에러 코드를 현재 표시 언어의 문구로 바꾼다. params 중 이름이 "Date"로 끝나는 값은
// 날짜(YYYY-MM-DD)라서 언어별 표기로 바꿔서 끼워 넣는다.
function translateApiError(code, params, serverMessage) {
  const lang = i18n.resolvedLanguage || 'ko'
  const values = {}
  for (const [key, value] of Object.entries(params || {})) {
    values[key] = key.endsWith('Date') && !Number.isNaN(Date.parse(value))
      ? formatDate(lang, new Date(`${value}T00:00:00`), { dateStyle: 'medium' })
      : value
  }
  return i18n.t(`errors:api.${code}`, { ...values, defaultValue: serverMessage })
}

export class ApiError extends Error {
  constructor(status, body) {
    const fallback = i18n.t('errors.generic')
    const serverMessage = body && typeof body === 'object' && body.message ? body.message : null
    const code = serverMessage && typeof body.code === 'string' ? body.code : null
    super(code ? translateApiError(code, body.params, serverMessage) : serverMessage || fallback)
    this.status = status
    this.code = code
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
