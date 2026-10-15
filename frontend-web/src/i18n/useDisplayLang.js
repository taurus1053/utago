import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS, DEFAULT_LANG } from './index'

// 현재 표시 언어와 변경 함수를 [lang, setLang]으로 돌려준다. LangSwitcher에 그대로
// 넘기면 된다. useTranslation을 쓰고 있어서 언어가 바뀌면 이 훅을 쓰는 컴포넌트는
// 자동으로 다시 그려진다.
export function useDisplayLang() {
  const { i18n } = useTranslation()
  const lang = SUPPORTED_LANGS.includes(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANG
  const setLang = useCallback((code) => {
    if (SUPPORTED_LANGS.includes(code)) i18n.changeLanguage(code)
  }, [i18n])
  return [lang, setLang]
}
