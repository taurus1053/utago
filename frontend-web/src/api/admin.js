// 관리자 전용 API 호출 — 소절 번역 캐시(line_translation_cache) 관리.
// 백엔드가 매 요청마다 로그인 계정의 role을 직접 확인하므로(AdminLineTranslationController),
// ADMIN이 아닌 계정으로 호출하면 403이 돌아온다.
import { apiGet, apiPost, apiPut, apiDelete } from './client'

// GET /api/users/me/role -> { role: "USER" | "ADMIN" }
export async function getMyRole() {
  return apiGet('/api/users/me/role')
}

// GET /api/admin/line-translations?sourceLang=&query=&page=&size=
// -> Spring Page<{ id, sourceLang, originalText, translationText, source, createdAt }>
export async function listLineTranslations({ sourceLang, query, page = 0, size = 20 } = {}) {
  const params = new URLSearchParams()
  if (sourceLang) params.set('sourceLang', sourceLang)
  if (query && query.trim()) params.set('query', query.trim())
  params.set('page', String(page))
  params.set('size', String(size))
  return apiGet(`/api/admin/line-translations?${params.toString()}`)
}

// POST /api/admin/line-translations
// 같은 원문(+언어)이 이미 캐시에 있으면 번역만 갱신, 없으면 새로 등록. 항상 source=ADMIN.
export async function upsertLineTranslation({ sourceLang, originalText, translationText }) {
  return apiPost('/api/admin/line-translations', { sourceLang, originalText, translationText })
}

// POST /api/admin/line-translations/batch
// 원문 여러 줄 + 번역 여러 줄을 같은 순서로 짝지어 한 번에 upsert. 항상 source=ADMIN.
export async function batchUpsertLineTranslations({ sourceLang, originalLines, translationLines }) {
  return apiPost('/api/admin/line-translations/batch', { sourceLang, originalLines, translationLines })
}

// PUT /api/admin/line-translations/{id} — 번역문만 수정(원문/언어는 안 바뀜).
export async function updateLineTranslation(id, translationText) {
  return apiPut(`/api/admin/line-translations/${id}`, { translationText })
}

// DELETE /api/admin/line-translations/{id}
export async function deleteLineTranslation(id) {
  return apiDelete(`/api/admin/line-translations/${id}`)
}
