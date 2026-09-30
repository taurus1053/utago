import { useEffect, useRef, useState } from 'react'
import './LangSwitcher.css'

// 페이지에 표시되는 언어(UI 문구)를 고르는 드롭다운. 로그인 상태(모국어 설정)와는
// 별개 — 그냥 이 화면을 어떤 언어로 보고 싶은지 고르는 것뿐이다. 원래 비로그인
// 랜딩 페이지에만 있던 걸 공용 컴포넌트로 뽑아서 로그인 후 화면(TopBar)에서도 쓴다.
export const DISPLAY_LANGS = [
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
]

export default function LangSwitcher({ lang, setLang }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const current = DISPLAY_LANGS.find((l) => l.code === lang) ?? DISPLAY_LANGS[0]

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="lang-switcher" ref={rootRef}>
      <button
        type="button"
        className="lang-switcher-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="표시 언어 선택"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M2 12h20"></path>
          <path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"></path>
        </svg>
        <span>{current.label}</span>
        <svg className={`lang-switcher-chevron${open ? ' lang-switcher-chevron--open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      {open && (
        <ul className="lang-switcher-menu" role="listbox">
          {DISPLAY_LANGS.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={l.code === lang}
                className={`lang-switcher-option${l.code === lang ? ' lang-switcher-option--active' : ''}`}
                onClick={() => {
                  setLang(l.code)
                  setOpen(false)
                }}
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
