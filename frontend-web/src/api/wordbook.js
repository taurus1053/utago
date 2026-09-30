// 단어장(마이 단어장/플래시카드) API 호출. 전부 로그인 필요 — client.js가 토큰을 자동으로 실어 보낸다.
import { apiDelete, apiGet, apiPatch, apiPost } from './client'

// GET /api/wordbooks
// -> [{ id, name, favoriteDefault, itemCount }, ...]  기본(즐겨찾기) 단어장이 맨 앞.
// 계정에 단어장이 하나도 없어도 서버가 즐겨찾기 단어장을 자동으로 만들어서 내려준다.
export async function listWordbooks() {
  return apiGet('/api/wordbooks')
}

// POST /api/wordbooks  payload: { name, folderId? }  folderId를 생략하면 폴더 없이 만들어진다.
export async function createWordbook(name, folderId) {
  return apiPost('/api/wordbooks', { name, folderId: folderId ?? null })
}

// DELETE /api/wordbooks/{id}  (기본 즐겨찾기 단어장은 삭제 불가 — 서버가 403으로 막음)
export async function deleteWordbook(id) {
  return apiDelete(`/api/wordbooks/${id}`)
}

// PATCH /api/wordbooks/{id}/name  payload: { name }
export async function renameWordbook(id, name) {
  return apiPatch(`/api/wordbooks/${id}/name`, { name })
}

// PATCH /api/wordbooks/{id}/folder  payload: { folderId }  folderId가 null이면 폴더에서 뺀다.
export async function moveWordbookToFolder(id, folderId) {
  return apiPatch(`/api/wordbooks/${id}/folder`, { folderId: folderId ?? null })
}

// GET /api/wordbooks/folders
// -> [{ id, name }, ...]
export async function listWordbookFolders() {
  return apiGet('/api/wordbooks/folders')
}

// POST /api/wordbooks/folders  payload: { name }
export async function createWordbookFolder(name) {
  return apiPost('/api/wordbooks/folders', { name })
}

// PATCH /api/wordbooks/folders/{id}  payload: { name }
export async function renameWordbookFolder(id, name) {
  return apiPatch(`/api/wordbooks/folders/${id}`, { name })
}

// DELETE /api/wordbooks/folders/{id}  (폴더를 지워도 안의 단어장은 삭제되지 않고 폴더 밖으로 나간다)
export async function deleteWordbookFolder(id) {
  return apiDelete(`/api/wordbooks/folders/${id}`)
}

// GET /api/wordbooks/{id}/items
// -> [{ id, wordId, lemma, lang, reading, meanings: [...], starred, status,
//        intervalDays, repetitionCount, nextReviewAt }, ...]
export async function listWordbookItems(wordbookId) {
  return apiGet(`/api/wordbooks/${wordbookId}/items`)
}

// POST /api/wordbooks/items  payload: { lemma, lang, wordbookId? }
// 곡 학습 화면 "단어장에 추가" 버튼에서 호출. wordbookId를 생략하면 기본(즐겨찾기)
// 단어장에 담긴다. 이미 있는 단어면 서버가 중복 생성하지 않고 기존 항목을 그대로 돌려준다.
export async function addWordbookItem({ lemma, lang, wordbookId }) {
  return apiPost('/api/wordbooks/items', { lemma, lang, wordbookId })
}

// DELETE /api/wordbooks/items/{itemId}
export async function removeWordbookItem(itemId) {
  return apiDelete(`/api/wordbooks/items/${itemId}`)
}

// PATCH /api/wordbooks/items/{itemId}/star — 즐겨찾기(별표) on/off 토글.
export async function toggleWordbookItemStar(itemId) {
  return apiPatch(`/api/wordbooks/items/${itemId}/star`, {})
}

// POST /api/wordbooks/items/{itemId}/review  payload: { know: boolean }
// 플래시카드에서 "안다"/"모른다" 버튼 — 서버가 간격 반복(SRS) 상태를 갱신해서 돌려준다.
export async function reviewWordbookItem(itemId, know) {
  return apiPost(`/api/wordbooks/items/${itemId}/review`, { know })
}

// POST /api/wordbooks/items/membership  payload: { lemmas: [...], lang }
// -> { [lemma]: [wordbookId, ...] }  이 소절의 단어들이 이미 어느 단어장에 담겨 있는지 한 번에 조회.
// 곡 학습 화면에서 소절이 바뀔 때마다 호출해서, 페이지를 나갔다 다시 들어와도 체크 표시가
// 유지되도록 한다(로컬 상태만으로는 새로고침/재방문 시 초기화되어버림).
export async function getWordbookMembership(lemmas, lang) {
  return apiPost('/api/wordbooks/items/membership', { lemmas, lang })
}

// GET /api/wordbooks/items/random
// 홈 화면 "단어 복습하기" — 내 단어장(즐겨찾기 포함 전체)에 담긴 단어 중 무작위 하나.
// 담긴 단어가 하나도 없으면 서버가 204를 내려주고, client.js가 이를 null로 돌려준다.
export async function getRandomWordbookItem() {
  return apiGet('/api/wordbooks/items/random')
}
