import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { listWordbooks } from '../api/wordbook'
import { createPost } from '../api/board'
import { ApiError } from '../api/client'
import './BoardWrite.css'

// "올릴 단어장" 선택 — 기본 HTML <select>는 브라우저마다 각기 다르게 못생기게 렌더링돼서,
// LangSwitcher(상단바 언어 선택)와 같은 버튼+패널 패턴으로 직접 만든다.
function WordbookPicker({ books, value, onChange }) {
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
        <span className="wordbook-picker-count">{selected?.itemCount}개</span>
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
                <span className="wordbook-picker-count">{b.itemCount}개</span>
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
      setError('올릴 단어장을 선택해주세요.')
      return
    }
    if (!title.trim() || !body.trim()) {
      setError('제목과 내용을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const post = await createPost({ wordbookId: Number(wordbookId), title: title.trim(), body: body.trim() })
      navigate(`/board/${post.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '게시글을 올리지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="board-write-page">
      <TopBar showSearch={false} />

      <div className="board-write-shell">
        <h1 className="board-write-title">단어장 게시글 쓰기</h1>

        {booksLoading ? (
          <div className="board-write-status">단어장을 불러오는 중...</div>
        ) : books.length === 0 ? (
          <div className="board-write-status">
            올릴 수 있는 단어장이 없어요. 먼저 단어장을 만들어주세요(즐겨찾기 단어장은 게시할 수 없어요).
          </div>
        ) : (
          <form className="board-write-form" onSubmit={handleSubmit}>
            <label className="board-write-field">
              <span className="board-write-label">올릴 단어장</span>
              <WordbookPicker books={books} value={wordbookId} onChange={setWordbookId} />
            </label>

            <label className="board-write-field">
              <span className="board-write-label">제목</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력해주세요"
                maxLength={100}
              />
            </label>

            <label className="board-write-field">
              <span className="board-write-label">내용</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="어떤 단어장인지 소개해주세요"
                rows={8}
              />
            </label>

            {error && <div className="board-write-error">{error}</div>}

            <div className="board-write-actions">
              <button type="button" className="board-write-cancel" onClick={() => navigate('/board')}>
                취소
              </button>
              <button type="submit" className="board-write-submit" disabled={submitting}>
                {submitting ? '올리는 중...' : '게시하기'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
