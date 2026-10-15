import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// 화면 표시 언어(UI 문구) 설정. 로그인한 사용자의 "모국어"(nativeLang)와는 별개로,
// 그냥 이 화면을 어떤 언어로 보고 싶은지만 정한다.
//
// 번역 문구는 locales/<언어코드>/<네임스페이스>.json 에 둔다. 아래 import.meta.glob이
// 그 폴더의 JSON을 전부 자동으로 모아주므로, 새 화면용 JSON 파일을 하나 추가하는
// 것만으로 등록이 끝난다(이 파일을 고칠 필요 없음). 파일 이름이 곧 네임스페이스다
// (예: locales/ko/landing.json -> useTranslation('landing')).

export const SUPPORTED_LANGS = ['ko', 'ja', 'en']
export const DEFAULT_LANG = 'ko'

// 랜딩/상단바가 따로 쓰던 저장 키를 하나로 통합했다. 예전 랜딩 키(utago_landing_lang)에
// 저장된 선택이 있으면 한 번 읽어서 새 키로 옮겨준다.
const STORAGE_KEY = 'utago_display_lang'
const LEGACY_LANDING_KEY = 'utago_landing_lang'

function readSavedLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved
    const legacy = localStorage.getItem(LEGACY_LANDING_KEY)
    if (legacy && SUPPORTED_LANGS.includes(legacy)) return legacy
  } catch {
    // localStorage를 못 쓰는 환경이면 저장된 선택은 없는 것으로 본다
  }
  return null
}

function detectInitialLang() {
  const saved = readSavedLang()
  if (saved) return saved
  // 처음 방문이면 브라우저 언어를 따라가고, 지원하지 않는 언어면 한국어
  const browser = (typeof navigator !== 'undefined' && navigator.language ? navigator.language : '')
    .slice(0, 2)
    .toLowerCase()
  return SUPPORTED_LANGS.includes(browser) ? browser : DEFAULT_LANG
}

// { ko: { common: {...}, landing: {...} }, ja: {...}, en: {...} } 형태로 조립
const modules = import.meta.glob('./locales/*/*.json', { eager: true, import: 'default' })
const resources = {}
const namespaces = new Set()
for (const [path, json] of Object.entries(modules)) {
  const match = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/)
  if (!match) continue
  const [, lng, ns] = match
  resources[lng] = resources[lng] || {}
  resources[lng][ns] = json
  namespaces.add(ns)
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectInitialLang(),
  // 번역이 빠진 키는 한국어 문구로 대신 보여준다(키 이름이 화면에 그대로 뜨는 것보다 낫다)
  fallbackLng: DEFAULT_LANG,
  supportedLngs: SUPPORTED_LANGS,
  ns: [...namespaces],
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React가 이미 이스케이프한다
})

// 언어가 바뀔 때마다 선택을 저장하고, 접근성/검색엔진용 <html lang>도 맞춰준다.
function applyLang(lng) {
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // 저장을 못 해도 언어 전환 자체는 계속 동작
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng
  }
}
applyLang(i18n.resolvedLanguage || DEFAULT_LANG)
i18n.on('languageChanged', applyLang)

export default i18n
