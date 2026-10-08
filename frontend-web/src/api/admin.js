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

// POST /api/admin/songs (ADMIN 전용)
// payload: { title, artist, sourceLang, youtubeVideoId, lines: [{ originalText, translationNatural }] }
// AI로 만든 학습곡(멜로디·보컬·가사까지 AI 제작, 관리자가 유튜브에 올려 가져온 곡)을
// 공개 카탈로그에 바로 등록한다 — 일반 곡 등록(createSong)과 달리 PRIVATE가 아니라
// 처음부터 PUBLIC으로 저장되어 홈 화면 "전체 곡" 섹션에 즉시 노출된다.
// -> 생성된 SongDetailResponse
export async function createAiLearningSong(payload) {
  return apiPost('/api/admin/songs', payload)
}

// GET /api/admin/songs/search?q=... (ADMIN 전용)
// 홈 화면 "오늘의 추천곡" 후보로 지정할 곡을 찾기 위한 검색 — 공개 범위 상관없이 제목/
// 아티스트로 전체 곡에서 검색한다. -> [{ id, title, artist, sourceLang, youtubeVideoId,
// visibility, featured }, ...] (최대 20개)
export async function searchSongsForAdmin(query) {
  const params = new URLSearchParams()
  if (query && query.trim()) params.set('q', query.trim())
  return apiGet(`/api/admin/songs/search?${params.toString()}`)
}

// GET /api/admin/songs/featured (ADMIN 전용)
// 현재 "오늘의 추천곡" 후보로 지정된 곡 전체 목록(제목순).
export async function listFeaturedSongs() {
  return apiGet('/api/admin/songs/featured')
}

// PUT /api/admin/songs/{songId}/featured { featured: boolean } (ADMIN 전용)
// 곡 하나를 오늘의 추천곡 후보로 켜거나 끈다. 유튜브 영상이 없는 곡을 켜려고 하면 400.
export async function setSongFeatured(songId, featured) {
  return apiPut(`/api/admin/songs/${songId}/featured`, { featured })
}

// GET /api/admin/songs/all?onlyUngenred=&page=&size= (ADMIN 전용)
// 곡 관리 화면 "전체 곡 둘러보기" — 검색어 없이 공개 범위 무관(비공개 포함) 전체 곡을 최신
// 등록순으로 페이지 단위로 가져온다. onlyUngenred=true면 아직 장르가 없는 곡만 걸러서 준다.
// -> Spring Page<AdminSongSummaryResponse>
export async function listAllSongsForAdmin({ onlyUngenred = false, page = 0, size = 20 } = {}) {
  const params = new URLSearchParams()
  params.set('onlyUngenred', String(onlyUngenred))
  params.set('page', String(page))
  params.set('size', String(size))
  return apiGet(`/api/admin/songs/all?${params.toString()}`)
}

// PUT /api/admin/songs/{songId}/genre { genre: string | null } (ADMIN 전용)
// 곡 하나의 장르를 지정하거나(값) 해제(null)한다. genre 값은 GENRE_OPTIONS의 코드와 같아야 한다.
export async function setSongGenre(songId, genre) {
  return apiPut(`/api/admin/songs/${songId}/genre`, { genre })
}
