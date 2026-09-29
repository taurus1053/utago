// 곡 목록/검색/상세/등록 API 호출.
import { apiGet, apiPost } from './client'

// GET /api/songs?query=&lang=&page=&size=
// -> Spring Page<SongSummaryResponse>: { content: [...], totalElements, totalPages, number, size, ... }
// 공개 카탈로그(visibility=PUBLIC, 게시된 곡)만 내려온다 (SongService 참고).
// 사용자가 직접 등록한 PRIVATE 곡은 여기 섞이지 않는다 — getMySongs() 참고.
export async function listSongs({ query, lang, page = 0, size = 20 } = {}) {
  const params = new URLSearchParams()
  if (query && query.trim()) params.set('query', query.trim())
  if (lang) params.set('lang', lang)
  params.set('page', String(page))
  params.set('size', String(size))
  return apiGet(`/api/songs?${params.toString()}`)
}

// POST /api/songs/translate-lines (로그인 필요)
// payload: { sourceLang, lines: ["원문1", "원문2", ...] }
// -> { available: boolean, translations: [...] }
// available=false 면 서버에 번역 API가 설정 안 돼있거나 실패한 것 — 수동 입력으로 유도할 것.
// 자동으로 저장되지 않는다 — 사용자가 검토/수정 후 createSong() 호출 시 같이 보내야 저장됨.
export async function translateLines(sourceLang, lines) {
  return apiPost('/api/songs/translate-lines', { sourceLang, lines })
}

// GET /api/songs/my (로그인 필요)
// 마이페이지 - 내가 등록한 곡 목록(공개 범위 무관, 전부 내 것만). 비로그인이면 401.
// -> Spring Page<SongSummaryResponse>
export async function getMySongs({ page = 0, size = 20 } = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('size', String(size))
  return apiGet(`/api/songs/my?${params.toString()}`)
}

// GET /api/songs/{id}
// -> SongDetailResponse: { id, title, artist, sourceLang, youtubeVideoId,
//      lines: [{ id, lineOrder, originalText, translationNatural, reading, startMs, endMs }],
//      grammarPoints: [{ id, pattern, explanation, exampleLineId }] }
// 로그인 상태면 백엔드가 사용자 모국어 기준으로 reading(발음 표기)을 맞춰서 내려준다.
export async function getSong(id) {
  return apiGet(`/api/songs/${id}`)
}

// POST /api/songs (로그인 필요)
// payload: { title, artist, sourceLang, youtubeVideoId, lines: [{ originalText, translationNatural }] }
// 가사 원문/번역은 서버가 채워주지 않는다 — 호출하는 쪽(사용자)이 직접 입력한 텍스트 그대로 저장된다.
// 등록된 곡은 항상 호출한 사용자 본인 소유의 PRIVATE 곡이 된다 — 다른 사용자에게는 보이지 않는다.
// -> 생성된 SongDetailResponse
export async function createSong(payload) {
  return apiPost('/api/songs', payload)
}

// GET /api/songs/lookup?youtubeVideoId=xxxx
// 이미 등록된 곡이면 { matchedExisting: true, existingSongId } 를,
// 아니면 { matchedExisting: false, suggestedTitle, suggestedArtist, youtubeTitle, youtubeChannel } 를 돌려준다.
// 가사는 절대 채워주지 않는다 — 제목/아티스트 추측 + 중복 확인까지만.
export async function lookupSongByYoutube(videoId) {
  return apiGet(`/api/songs/lookup?youtubeVideoId=${encodeURIComponent(videoId)}`)
}

// 유튜브 URL(다양한 형식)에서 영상 ID만 뽑아낸다. 못 찾으면 null.
export function extractYoutubeVideoId(url) {
  if (!url) return null
  const trimmed = url.trim()

  // 이미 순수 영상 ID만 붙여넣은 경우 (11자, 영숫자/-/_)
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed

  try {
    const u = new URL(trimmed)
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.slice(1).split('/')[0] || null
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v')
      const shortsMatch = u.pathname.match(/\/shorts\/([\w-]{11})/)
      if (shortsMatch) return shortsMatch[1]
      const embedMatch = u.pathname.match(/\/embed\/([\w-]{11})/)
      if (embedMatch) return embedMatch[1]
    }
  } catch {
    // URL 파싱 실패 — 아래 정규식 폴백으로 넘어감
  }

  const fallbackMatch = trimmed.match(/[\w-]{11}/)
  return fallbackMatch ? fallbackMatch[0] : null
}
