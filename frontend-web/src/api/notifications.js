// 알림 API — claude/소셜_마이페이지_기획.md 21번. 친구 요청/수락, 내 글 댓글/좋아요 알림.
// 전부 로그인 필요(client.js가 토큰을 자동으로 실어 보낸다).
import { apiGet, apiPost } from './client'

// GET /api/notifications?page=&size=
// -> Spring Page<{ id, type, actorNickname, actorAvatarColor, actorAvatarInitial,
//                   message, targetUrl, read, createdAt }>
export async function listNotifications({ page = 0, size = 20 } = {}) {
  return apiGet(`/api/notifications?page=${page}&size=${size}`)
}

// GET /api/notifications/unread-count -> { count }
export async function getUnreadNotificationCount() {
  return apiGet('/api/notifications/unread-count')
}

export async function markNotificationRead(id) {
  return apiPost(`/api/notifications/${id}/read`, {})
}

export async function markAllNotificationsRead() {
  return apiPost('/api/notifications/read-all', {})
}
