import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { listPosts } from '../api/board'
import './BoardList.css'

const SORT_TABS = [
  { key: 'popular', label: '인기순' },
  { key: 'latest', label: '최신순' },
  { key: 'downloads', label: '다운로드순' },
]

function timeAgo(isoString) {
  if (!isoString) return ''
  const diffMs = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전`
  return new Date(isoString).toLocaleDateString('ko-KR')
}

// "단어장 둘러보기" 게시판 목록 — 다른 사람이 공개로 올린 단어장을 카드로 둘러보고,
// 마음에 들면 상세로 들어가 "내 단어장에 추가"(다운로드)할 수 있다.
export default function BoardList() {
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
        if (!cancelled) setError('게시글을 불러오지 못했어요.')
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
          <h1 className="board-title">단어장 둘러보기</h1>
          <button type="button" className="board-write-btn" onClick={() => navigate('/board/new')}>
            + 글쓰기
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
                {tab.label}
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
              placeholder="제목 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <div className="board-status">불러오는 중...</div>
        ) : error ? (
          <div className="board-status board-status--error">{error}</div>
        ) : filteredPosts.length === 0 ? (
          <div className="board-status">아직 올라온 단어장이 없어요. 첫 게시글을 올려보세요!</div>
        ) : (
          <div className="board-card-list">
            {filteredPosts.map((post) => (
              <article
                key={post.id}
                className="board-card"
                onClick={() => navigate(`/board/${post.id}`)}
              >
                <div className="board-card-top">
                  {post.official && <span className="board-card-badge">공식</span>}
                  <span className="board-card-author">{post.authorNickname}</span>
                  <span className="board-card-dot">·</span>
                  <span className="board-card-date">{timeAgo(post.createdAt)}</span>
                </div>
                <h2 className="board-card-title">{post.title}</h2>
                <p className="board-card-summary">{post.body}</p>
                <div className="board-card-wordbook-chip">
                  <span className="board-card-wordbook-emoji">{post.wordbookEmoji || '📘'}</span>
                  <span className="board-card-wordbook-text">
                    <span className="board-card-wordbook-name">{post.wordbookName}</span>
                    <span className="board-card-wordbook-count">{post.wordbookItemCount}개 단어</span>
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
