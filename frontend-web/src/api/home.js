// 홈 화면 "오늘의 가사" / "가사 복습하기" API.
import { apiGet } from './client'

// GET /api/home/lyric-of-day
// -> { songLineId, songId, songTitle, artist, originalText, translationNatural,
//      words: [{ wordId, lemma, lang, reading, meanings: [...], start, end }, ...] }
// 단어장에 있고 없고 상관없이 공개 가사 전체에서 무작위 소절. 후보가 하나도 없으면
// 서버가 204를 내려주고 client.js가 이를 null로 돌려준다.
export async function getLyricOfDay() {
  return apiGet('/api/home/lyric-of-day')
}

// GET /api/home/lyric-review
// 내 단어장에 담긴 단어가 실제로 등장하는 소절 중 무작위 하나(위와 같은 응답 모양).
// 단어장이 비어있거나 등장하는 공개 가사가 없으면 null.
export async function getLyricReview() {
  return apiGet('/api/home/lyric-review')
}
