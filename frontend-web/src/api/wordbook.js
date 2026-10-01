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

// PATCH /api/wordbooks/{id}/visibility  payload: { visible: boolean }
// 단어장 "⋮" 메뉴 "공개 설정" — 즐겨찾기 단어장을 공개로 돌리려 하면 400 + { message }.
export async function setWordbookVisibility(id, visible) {
  return apiPatch(`/api/wordbooks/${id}/visibility`, { visible })
}

// PATCH /api/wordbooks/{id}/emoji  payload: { emoji }
export async function updateWordbookEmoji(id, emoji) {
  return apiPatch(`/api/wordbooks/${id}/emoji`, { emoji })
}

// POST /api/wordbooks/{id}/download
// 공개(또는 공식) 단어장을 내 단어장에 통째로 복사해온다(스냅샷 — 이후 원본이 바뀌어도
// 반영 안 됨). 비공개 단어장이면 400 + { message }.
export async function downloadWordbook(id) {
  return apiPost(`/api/wordbooks/${id}/download`, {})
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

// GET /api/wordbooks/items/lookup?lemma=...&lang=JA
// 단어장 화면 "단어 추가" 창 — 단어 입력칸에서 디바운스로 호출하는 자동 조회(발음/뜻 미리보기).
// -> { lemma, reading, meanings: [...], found }  found가 false면 사전에 없는 단어 — 직접 입력 필요.
// 이미 마스터 사전에 있던 단어거나 지난 조회에서 캐시된 단어면 즉시(AI 호출 없이) 응답한다.
export async function lookupWordbookWord(lemma, lang = 'JA') {
  return apiGet(`/api/wordbooks/items/lookup?lemma=${encodeURIComponent(lemma)}&lang=${lang}`)
}

// POST /api/wordbooks/items/custom  payload: { lemma, lang, wordbookId?, reading?, meanings? }
// 단어장 화면 "단어 추가" — 가사에 없는 단어를 직접 입력해서 담는다. reading/meanings는 보통
// 위 lookup으로 자동 채워진 뒤 사용자가 확인/수정한 최종 값 — 채워서 보내면 서버가 그 값을
// 그대로 저장한다(다시 AI를 부르지 않음). 비워서 보내면 서버가 사전에서 찾아 자동으로 채운다.
// 사전에도 없고 reading/meanings도 비어있으면 400 + { message } (ApiError.message로 보여주면 됨).
export async function addCustomWordbookItem({ lemma, lang = 'JA', wordbookId, reading, meanings }) {
  return apiPost('/api/wordbooks/items/custom', { lemma, lang, wordbookId, reading, meanings })
}

// PATCH /api/wordbooks/items/{itemId}/word  payload: { reading, meanings }
// 단어장 목록 화면 "수정" — 오타/잘못 입력한 발음·뜻을 고친다. 실패(발음/뜻이 비어있음 등)는
// 400 + { message } (ApiError.message로 그대로 보여주면 됨).
export async function updateWordbookItemWord(itemId, { reading, meanings }) {
  return apiPatch(`/api/wordbooks/items/${itemId}/word`, { reading, meanings })
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
