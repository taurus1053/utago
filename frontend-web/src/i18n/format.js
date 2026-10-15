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

// "5분 전" / "5 minutes ago" / "5分前" — 언어별 상대 시간 표기(Intl.RelativeTimeFormat).
// value는 과거면 음수(-5), unit은 'minute' | 'hour' | 'day'.
const relCache = new Map()

export function formatRelative(lang, value, unit) {
  let formatter = relCache.get(lang)
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(lang, { numeric: 'always' })
    relCache.set(lang, formatter)
  }
  return formatter.format(value, unit)
}
