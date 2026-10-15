// 언어별 날짜 표기. 문구를 직접 이어 붙이면("2000년 1월 5일") 다른 언어에서 어색해서,
// 브라우저 Intl이 각 언어의 표기 규칙대로 만들어주게 한다.
// ko: 2000년 1월 5일 / ja: 2000年1月5日 / en: January 5, 2000
const cache = new Map()

export function formatDate(lang, date, options) {
  const key = lang + JSON.stringify(options)
  let formatter = cache.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(lang, options)
    cache.set(key, formatter)
  }
  return formatter.format(date)
}
