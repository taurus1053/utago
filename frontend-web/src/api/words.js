// 사전(단어) 관련 API. 단어장과 무관하게 전체 사전에서 단어를 조회할 때 쓴다.
import { apiGet } from './client'

// GET /api/words/random?lang=JA
// 홈 화면 "오늘의 단어" — 단어장에 있고 없고 상관없이, 뜻이 있는 단어 중 무작위 하나 +
// (있으면) 실제 가사 예문. 사전에 뜻이 달린 단어가 하나도 없으면 서버가 204를 내려주고,
// client.js가 이를 null로 돌려준다.
export async function getRandomWord(lang = 'JA') {
  return apiGet(`/api/words/random?lang=${lang}`)
}
