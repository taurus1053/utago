// 마이페이지 프로필 API — 전부 로그인 필요(client.js가 토큰을 자동으로 실어 보낸다).
import { apiGet, apiPatch, apiPost } from './client'

// GET /api/users/me
// -> { nickname, avatarColor, avatarInitial, statusMessage, title, learningLangFlag, nativeLang }
// title은 2026-10-07부터 TitleService가 실제 통계 기준으로 계산한 "현재 착용 칭호" 이름이다
// (claude/소셜_마이페이지_기획.md 15-6번). learningLangFlag는 지금은 일본어만 지원해서 고정값("ja").
// nativeLang("JA"|"KO"|"EN")은 2026-10-08 추가 — Home.jsx가 "전체 곡" 언어 필터에서
// 모국어 탭을 숨기는 데 쓴다(모국어 곡은 서버가 애초에 안 내려줌 — SongService.listSongs).
export async function getMyPage() {
  return apiGet('/api/users/me')
}

// PATCH /api/users/me  payload: { statusMessage }  빈 문자열/공백이면 지워진다.
export async function updateStatusMessage(statusMessage) {
  return apiPatch('/api/users/me', { statusMessage })
}

// GET /api/users/me/stats — 마이페이지 학습 통계 4타일 + 스트릭 캘린더.
// -> { wordsLearned, linesCompleted, songsCompleted, currentStreakDays, longestStreakDays,
//      totalActiveDays, calendar: [{ date: "yyyy-MM-dd", active: boolean, wordReviewCount }, ...] }
// totalActiveDays는 스트릭(연속)과 무관하게 실제로 학습한 전체 날짜 수 — "학습일수" 타일에 쓴다.
export async function getMyStats() {
  return apiGet('/api/users/me/stats')
}

// GET /api/users/me/titles — 칭호 컬렉션(카테고리별 달성 현황) + 현재 착용 칭호.
export async function getMyTitles() {
  return apiGet('/api/users/me/titles')
}

// PATCH /api/users/me/equipped-title  payload: { code }
export async function equipTitle(code) {
  return apiPatch('/api/users/me/equipped-title', { code })
}

// POST /api/users/me/study-ping  payload: { seconds }
// 학습 화면(SongLearn 등)이 약 30초 간격으로 보내는 체류시간 하트비트 — 누적 학습시간
// 칭호(1/5/10/30/50/100시간)의 원천 데이터가 된다. 실패해도 조용히 무시해도 되는 신호성
// 요청이라 호출하는 쪽에서 .catch(() => {})로 처리한다.
export async function sendStudyPing(seconds) {
  return apiPost('/api/users/me/study-ping', { seconds })
}
