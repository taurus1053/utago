// "단어장 둘러보기" 게시판 API — 전부 로그인 필요(client.js가 토큰을 자동으로 실어 보낸다).
import { apiDelete, apiGet, apiPost } from './client'

// GET /api/board/posts?sort=latest|popular|downloads&page=&size=
// -> Spring Data Page 객체. content가 실제 카드 배열 — 나머지(totalPages 등)는 지금은 안 쓴다.
// -> content: [{ id, title, authorNickname, official, createdAt, likeCount, commentCount,
//               wordbookDownloadCount, likedByMe, wordbookId, wordbookName, wordbookEmoji,
//               wordbookItemCount, wordbookPreviewLemmas: [...] }, ...]
export async function listPosts(sort = 'latest', { page = 0, size = 20 } = {}) {
  const res = await apiGet(`/api/board/posts?sort=${sort}&page=${page}&size=${size}`)
  return res?.content ?? []
}

// GET /api/board/posts/{id}
// -> { id, title, body, authorNickname, mine, official, createdAt, likeCount, commentCount,
//      wordbookDownloadCount, likedByMe, wordbookId, wordbookName, wordbookEmoji,
//      wordbookItemCount, wordbookPreviewLemmas: [...], comments: [...] }
export async function getPost(id) {
  return apiGet(`/api/board/posts/${id}`)
}

// POST /api/board/posts  payload: { wordbookId, title, body }
// 글을 올리면 해당 단어장이 자동으로 공개(PUBLIC) 전환된다(서버 쪽 처리, 별도 호출 불필요).
export async function createPost({ wordbookId, title, body }) {
  return apiPost('/api/board/posts', { wordbookId, title, body })
}

export async function deletePost(id) {
  return apiDelete(`/api/board/posts/${id}`)
}

// POST /api/board/posts/{id}/comments  payload: { content }
export async function addComment(postId, content) {
  return apiPost(`/api/board/posts/${postId}/comments`, { content })
}

export async function deleteComment(postId, commentId) {
  return apiDelete(`/api/board/posts/${postId}/comments/${commentId}`)
}

// POST /api/board/posts/{id}/like — 토글(이미 눌렀으면 취소). -> { liked: boolean }
export async function toggleLike(postId) {
  return apiPost(`/api/board/posts/${postId}/like`, {})
}

// POST /api/board/posts/{id}/save — 저장(북마크) 토글(이미 저장했으면 취소). -> { saved: boolean }
export async function toggleSave(postId) {
  return apiPost(`/api/board/posts/${postId}/save`, {})
}
