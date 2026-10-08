// 친구 기능 API — claude/소셜_마이페이지_기획.md 4-2번(설계) / 18번(구현).
// 전부 로그인 필요(client.js가 토큰을 자동으로 실어 보낸다).
import { apiDelete, apiGet, apiPost } from './client'

// GET /api/friends/search?nickname=
// -> [{ userId, nickname, avatarColor, avatarInitial, relation }, ...]
// relation: "NONE" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "FRIENDS"
export async function searchFriends(nickname) {
  return apiGet(`/api/friends/search?nickname=${encodeURIComponent(nickname)}`)
}

// POST /api/friends/requests  payload: { addresseeUserId }
export async function sendFriendRequest(addresseeUserId) {
  return apiPost('/api/friends/requests', { addresseeUserId })
}

// GET /api/friends/requests/incoming -> [{ requestId, userId, nickname, avatarColor, avatarInitial, createdAt }, ...]
export async function listIncomingRequests() {
  return apiGet('/api/friends/requests/incoming')
}

// GET /api/friends/requests/outgoing -> 위와 같은 모양, 상대는 "요청을 받은 사람" 기준.
export async function listOutgoingRequests() {
  return apiGet('/api/friends/requests/outgoing')
}

export async function acceptRequest(requestId) {
  return apiPost(`/api/friends/requests/${requestId}/accept`, {})
}

export async function declineRequest(requestId) {
  return apiPost(`/api/friends/requests/${requestId}/decline`, {})
}

// 보낸 요청 취소 — decline과 다른 메서드(DELETE)를 쓰지만 효과는 같다(행 삭제).
export async function cancelRequest(requestId) {
  return apiDelete(`/api/friends/requests/${requestId}`)
}

// GET /api/friends -> [{ userId, nickname, avatarColor, avatarInitial, statusMessage }, ...]
export async function listFriends() {
  return apiGet('/api/friends')
}

export async function removeFriend(friendUserId) {
  return apiDelete(`/api/friends/${friendUserId}`)
}
