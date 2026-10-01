// 홈 화면 "오늘의 추천곡" / "가사 복습하기" API.
import { apiGet } from './client'

// GET /api/home/song-of-day
// -> { songId, title, artist, sourceLang, youtubeVideoId }
// 가사 원문/번역은 포함하지 않는다(저작권 문제로 "가사 텍스트 노출 없는 곡 추천" 방식으로
// 전환 — 단어장과 무관하게 공개 곡 전체에서 무작위). 후보가 하나도 없으면 서버가 204를
// 내려주고 client.js가 이를 null로 돌려준다.
export async function getSongOfDay() {
  return apiGet('/api/home/song-of-day')
}

// GET /api/home/lyric-review
// 내 단어장에 담긴 단어가 실제로 등장하는 소절 중 무작위 하나(위와 같은 응답 모양).
// 단어장이 비어있거나 등장하는 공개 가사가 없으면 null.
export async function getLyricReview() {
  return apiGet('/api/home/lyric-review')
}
