import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar'
import { listWordbooks } from '../api/wordbook'
import { createPost } from '../api/board'
import { ApiError } from '../api/client'
import './BoardWrite.css'

// "올릴 단어장" 선택 — 기본 HTML <select>는 브라우저마다 각기 다르게 못생기게 렌더링돼서,
// LangSwitcher(상단바 언어 선택)와 같은 버튼+패널 패턴으로 직접 만든다.
function WordbookPicker({ books, value, onChange }) {
  const { t } = useTranslation('board')
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const selected = books.find((b) => String(b.id) === String(value))

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
    <div className="wordbook-picker" ref={rootRef}>
      <button
        type="button"
        className="wordbook-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="wordbook-picker-emoji">{selected?.emoji || '📘'}</span>
        <span className="wordbook-picker-name">{selected?.name}</span>
        <span className="wordbook-picker-count">{selected ? t('wordsShort', { count: selected.itemCount }) : ''}</span>
        <svg className={`wordbook-picker-chevron${open ? ' wordbook-picker-chevron--open' : ''}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      {open && (
        <ul className="wordbook-picker-menu" role="listbox">
          {books.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                role="option"
                aria-selected={String(b.id) === String(value)}
                className={`wordbook-picker-option${String(b.id) === String(value) ? ' wordbook-picker-option--active' : ''}`}
                onClick={() => {
                  onChange(String(b.id))
                  setOpen(false)
                }}
              >
                <span className="wordbook-picker-emoji">{b.emoji || '📘'}</span>
                <span className="wordbook-picker-name">{b.name}</span>
                <span className="wordbook-picker-count">{t('wordsShort', { count: b.itemCount })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// 게시판 글쓰기 — 즐겨찾기가 아닌 내 단어장 중 하나를 골라 제목/본문을 붙여 올린다.
// 올리는 순간 그 단어장은 자동으로 공개(PUBLIC) 전환된다(서버 처리).
export default function BoardWrite() {
  const { t } = useTranslation('board')
  const navigate = useNavigate()
  const [books, setBooks] = useState([])
  const [booksLoading, setBooksLoading] = useState(true)
  const [wordbookId, setWordbookId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    listWordbooks()
      .then((data) => {
        const shareable = (data || []).filter((b) => !b.favoriteDefault)
        setBooks(shareable)
        if (shareable.length > 0) setWordbookId(String(shareable[0].id))
      })
      .catch(() => setBooks([]))
      .finally(() => setBooksLoading(false))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    if (!wordbookId) {
      setError(t('write.errorPickBook'))
      return
    }
    if (!title.trim() || !body.trim()) {
      setError(t('write.errorRequired'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const post = await createPost({ wordbookId: Number(wordbookId), title: title.trim(), body: body.trim() })
      navigate(`/board/${post.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('write.errorFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="board-write-page">
      <TopBar showSearch={false} />

      <div className="board-write-shell">
        <h1 className="board-write-title">{t('write.title')}</h1>

        {booksLoading ? (
          <div className="board-write-status">{t('write.loadingBooks')}</div>
        ) : books.length === 0 ? (
          <div className="board-write-status">
            {t('write.noBooks')}
          </div>
        ) : (
          <form className="board-write-form" onSubmit={handleSubmit}>
            <label className="board-write-field">
              <span className="board-write-label">{t('write.pickBook')}</span>
              <WordbookPicker books={books} value={wordbookId} onChange={setWordbookId} />
            </label>

            <label className="board-write-field">
              <span className="board-write-label">{t('write.titleLabel')}</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('write.titlePlaceholder')}
                maxLength={100}
              />
            </label>

            <label className="board-write-field">
              <span className="board-write-label">{t('write.bodyLabel')}</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t('write.bodyPlaceholder')}
                rows={8}
              />
            </label>

            {error && <div className="board-write-error">{error}</div>}

            <div className="board-write-actions">
              <button type="button" className="board-write-cancel" onClick={() => navigate('/board')}>
                {t('common:actions.cancel')}
              </button>
              <button type="submit" className="board-write-submit" disabled={submitting}>
                {submitting ? t('write.submitting') : t('write.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
