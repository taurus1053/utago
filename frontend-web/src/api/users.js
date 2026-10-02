// 마이페이지 프로필 API — 전부 로그인 필요(client.js가 토큰을 자동으로 실어 보낸다).
import { apiGet, apiPatch } from './client'

// GET /api/users/me
// -> { nickname, avatarColor, avatarInitial, statusMessage, title, learningLangFlag }
// title은 칭호 시스템 설계가 아직 안 끝나서 고정 placeholder 문구, learningLangFlag도
// 지금은 일본어만 지원해서 고정값("ja")이다.
export async function getMyPage() {
  return apiGet('/api/users/me')
}

// PATCH /api/users/me  payload: { statusMessage }  빈 문자열/공백이면 지워진다.
export async function updateStatusMessage(statusMessage) {
  return apiPatch('/api/users/me', { statusMessage })
}
