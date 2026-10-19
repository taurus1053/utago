import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatDate, formatRelative } from '../i18n/format'
import TopBar from '../components/TopBar'
import { listPosts } from '../api/board'
import './BoardList.css'

// 탭 이름은 화면에서 t(`sort.${key}`)로 번역한다
const SORT_TABS = [{ key: 'popular' }, { key: 'latest' }, { key: 'downloads' }]

// "방금 전 / 5분 전 / 3시간 전 / 2일 전" — 한 달이 넘으면 날짜로. 표기는 언어별 Intl이 만든다.
function timeAgo(isoString, lang, justNowText) {
  if (!isoString) return ''
  const diffMs = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return justNowText
  if (minutes < 60) return formatRelative(lang, -minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return formatRelative(lang, -hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 30) return formatRelative(lang, -days, 'day')
  return formatDate(lang, new Date(isoString), { dateStyle: 'medium' })
}

// "단어장 둘러보기" 게시판 목록 — 다른 사람이 공개로 올린 단어장을 카드로 둘러보고,
// 마음에 들면 상세로 들어가 "내 단어장에 추가"(다운로드)할 수 있다.
export default function BoardList() {
  const { t, i18n } = useTranslation('board')
  const lang = i18n.resolvedLanguage || 'ko'
  const navigate = useNavigate()
  const [sort, setSort] = useState('popular')
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listPosts(sort)
      .then((data) => {
        if (!cancelled) setPosts(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sort])

  const filteredPosts = useMemo(() => {
    const q = query.trim()
    if (!q) return posts
    return posts.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()))
  }, [posts, query])

  return (
    <div className="board-page">
      <TopBar showSearch={false} />

      <div className="board-shell">
        <div className="board-header">
          <h1 className="board-title">{t('title')}</h1>
          <button type="button" className="board-write-btn" onClick={() => navigate('/board/new')}>
            {t('writeBtn')}
          </button>
        </div>

        <div className="board-toolbar">
          <nav className="board-sort-tabs">
            {SORT_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`board-sort-tab${sort === tab.key ? ' board-sort-tab--active' : ''}`}
                onClick={() => setSort(tab.key)}
              >
                {t(`sort.${tab.key}`)}
              </button>
            ))}
          </nav>
          <label className="board-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <div className="board-status">{t('common:actions.loading')}</div>
        ) : error ? (
          <div className="board-status board-status--error">{t('loadError')}</div>
        ) : filteredPosts.length === 0 ? (
          <div className="board-status">{t('empty')}</div>
        ) : (
          <div className="board-card-list">
            {filteredPosts.map((post) => (
              <article
                key={post.id}
                className="board-card"
                onClick={() => navigate(`/board/${post.id}`)}
              >
                <div className="board-card-top">
                  {post.official && <span className="board-card-badge">{t('official')}</span>}
                  <span className="board-card-author">{post.authorNickname}</span>
                  <span className="board-card-dot">·</span>
                  <span className="board-card-date">{timeAgo(post.createdAt, lang, t('justNow'))}</span>
                </div>
                <h2 className="board-card-title">{post.title}</h2>
                <p className="board-card-summary">{post.body}</p>
                <div className="board-card-wordbook-chip">
                  <span className="board-card-wordbook-emoji">{post.wordbookEmoji || '📘'}</span>
                  <span className="board-card-wordbook-text">
                    <span className="board-card-wordbook-name">{post.wordbookName}</span>
                    <span className="board-card-wordbook-count">{t('wordCount', { count: post.wordbookItemCount })}</span>
                  </span>
                </div>
                <div className="board-card-stats">
                  <span>♥ {post.likeCount}</span>
                  <span>💬 {post.commentCount}</span>
                  <span>⬇ {post.wordbookDownloadCount}</span>
                  <span className="board-card-save-stat">
                    {/* 게시글 상세의 저장 버튼과 같은 북마크 아웃라인 아이콘 — 이모지(🔖)가
                        글꼴에 따라 이상하게 보여서 상세 화면과 통일된 인라인 SVG로 교체. */}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                    </svg>
                    {post.saveCount}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
