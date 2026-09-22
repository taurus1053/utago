// 백엔드 API 호출을 위한 아주 작은 공용 클라이언트.
// 나중에 곡 목록, 단어장 등 실제 API가 늘어나면 이 파일에 함수를 추가하세요.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export async function apiGet(path) {
  const res = await fetch(`${API_BASE_URL}${path}`)
  if (!res.ok) {
    throw new Error(`API 요청 실패: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export async function getHealth() {
  return apiGet('/api/health')
}
