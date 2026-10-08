// "문법 학습" 섹션(곡과 무관한 문법 사전) API 호출 — claude/기획_정리.md 2026-10-08 신규.
import { apiGet, apiPatch } from './client'

// GET /api/grammar?level=N5 (로그인 없이도 조회 가능)
// -> [{ id, level, pattern, meaning, learned }]
// 로그인 상태면 learned가 실제 사용자 체크 상태로, 비로그인이면 전부 false로 내려온다.
export async function getGrammarList(level) {
  return apiGet(`/api/grammar?level=${encodeURIComponent(level)}`)
}

// GET /api/grammar/{id}
// -> { id, level, pattern, meaning, explanation, structure, exampleSentence,
//      exampleTranslation, learned, songs: [{ songId, title, artist }] }
export async function getGrammarDetail(id) {
  return apiGet(`/api/grammar/${id}`)
}

// PATCH /api/grammar/{id}/learned (로그인 필요)
// payload: { learned: boolean } -> 갱신된 GrammarEntryDetailResponse
export async function setGrammarLearned(id, learned) {
  return apiPatch(`/api/grammar/${id}/learned`, { learned })
}
