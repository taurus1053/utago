import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { getPost, toggleLike, toggleSave, addComment, deleteComment, deletePost } from '../api/board'
import { downloadWordbook } from '../api/wordbook'
import { ApiError } from '../api/client'
import './BoardDetail.css'

// "2026.10.02" 형식 — toLocaleDateString('ko-KR')는 "2026. 10. 2."처럼 공백/마지막 점이
// 붙어서 직접 포맷한다.
function formatDate(isoString) {
  const d = new Date(isoString)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

export default function BoardDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [commentValue, setCommentValue] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [downloadState, setDownloadState] = useState('idle') // idle | busy | done | error
  const [downloadError, setDownloadError] = useState(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function load() {
    setLoading(true)
    setError(null)
    getPost(id)
      .then(setPost)
      .catch(() => setError('게시글을 불러오지 못했어요.'))
      .finally(() => setLoading(false))
  }

  async function handleLike() {
    if (!post) return
    const prev = post
    // 낙관적 업데이트 — 누르자마자 바로 반영하고, 실패하면 되돌린다.
    setPost({
      ...post,
      likedByMe: !post.likedByMe,
      likeCount: post.likeCount + (post.likedByMe ? -1 : 1),
    })
    try {
      await toggleLike(post.id)
    } catch {
      setPost(prev)
    }
  }

  async function handleSave() {
    if (!post) return
    const prev = post
    // 좋아요와 마찬가지로 낙관적 업데이트 — 누르자마자 바로 반영하고, 실패하면 되돌린다.
    setPost({ ...post, savedByMe: !post.savedByMe })
    try {
      await toggleSave(post.id)
    } catch {
      setPost(prev)
    }
  }

  async function handleDownload() {
    if (!post || downloadState === 'busy') return
    setDownloadState('busy')
    setDownloadError(null)
    try {
      await downloadWordbook(post.wordbookId)
      setDownloadState('done')
    } catch (err) {
      setDownloadState('error')
      setDownloadError(err instanceof ApiError ? err.message : '추가하지 못했어요. 잠시 후 다시 시도해주세요.')
    }
  }

  async function handleAddComment(e) {
    e.preventDefault()
    if (!commentValue.trim() || commentSubmitting) return
    setCommentSubmitting(true)
    try {
      const comment = await addComment(post.id, commentValue.trim())
      setPost((prev) => ({
        ...prev,
        comments: [...prev.comments, comment],
        commentCount: prev.commentCount + 1,
      }))
      setCommentValue('')
    } catch {
      // 실패하면 입력값은 그대로 남겨둬서 다시 시도할 수 있게 한다.
    } finally {
      setCommentSubmitting(false)
    }
  }

  async function handleDeleteComment(commentId) {
    if (!window.confirm('댓글을 삭제할까요?')) return
    try {
      await deleteComment(post.id, commentId)
      setPost((prev) => ({
        ...prev,
        comments: prev.comments.filter((c) => c.id !== commentId),
        commentCount: Math.max(0, prev.commentCount - 1),
      }))
    } catch {
      // 실패하면 목록이 그대로 남는다.
    }
  }

  async function handleDeletePost() {
    if (!window.confirm('게시글을 삭제할까요?')) return
    try {
      await deletePost(post.id)
      navigate('/board')
    } catch {
      alert('게시글을 삭제하지 못했어요.')
    }
  }

  return (
    <div className="board-detail-page">
      <TopBar showSearch={false} />

      <div className="board-detail-shell">
        {loading ? (
          <div className="board-detail-status">불러오는 중...</div>
        ) : error || !post ? (
          <div className="board-detail-status board-detail-status--error">{error || '게시글을 찾을 수 없어요.'}</div>
        ) : (
          <>
            <button type="button" className="board-detail-back-link" onClick={() => navigate('/board')}>
              ← 단어장 둘러보기
            </button>

            <h1 className="board-detail-title">{post.title}</h1>

            <div className="board-detail-top">
              <div className="board-detail-author-avatar">{post.authorNickname?.[0]}</div>
              <span className="board-detail-author">{post.authorNickname}</span>
              {post.official && <span className="board-detail-badge">공식</span>}
              <span className="board-detail-dot">·</span>
              <span className="board-detail-date">{formatDate(post.createdAt)}</span>
              {post.mine && (
                <button type="button" className="board-detail-delete-link" onClick={handleDeletePost}>
                  삭제
                </button>
              )}
            </div>

            <hr className="board-detail-divider" />

            <p className="board-detail-body">{post.body}</p>

            <div className="board-detail-wordbook-card">
              <div className="board-detail-wordbook-info">
                <span className="board-detail-wordbook-emoji">{post.wordbookEmoji || '📘'}</span>
                <div>
                  <div className="board-detail-wordbook-name">{post.wordbookName}</div>
                  <div className="board-detail-wordbook-meta">
                    {post.wordbookItemCount}개 단어 · 다운로드 {post.wordbookDownloadCount}회
                  </div>
                  {post.wordbookPreviewLemmas?.length > 0 && (
                    <div className="board-detail-wordbook-preview">
                      {post.wordbookPreviewLemmas.join(', ')}
                      {post.wordbookItemCount > post.wordbookPreviewLemmas.length ? ' ...' : ''}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="board-detail-download-btn"
                onClick={handleDownload}
                disabled={downloadState === 'busy' || downloadState === 'done'}
              >
                {downloadState === 'done' ? '추가됨' : downloadState === 'busy' ? '추가하는 중...' : '내 단어장에 추가'}
              </button>
            </div>
            {downloadError && <div className="board-detail-download-error">{downloadError}</div>}

            <div className="board-detail-actions">
              <button
                type="button"
                className={`board-detail-like-btn${post.likedByMe ? ' board-detail-like-btn--active' : ''}`}
                onClick={handleLike}
              >
                {post.likedByMe ? '♥' : '♡'} 좋아요 {post.likeCount}
              </button>
              <span className="board-detail-comment-count">💬 댓글 {post.commentCount}</span>
              <button
                type="button"
                className={`board-detail-save-btn${post.savedByMe ? ' board-detail-save-btn--active' : ''}`}
                onClick={handleSave}
                aria-pressed={post.savedByMe}
                aria-label={post.savedByMe ? '저장 취소' : '저장하기'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={post.savedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
              </button>
            </div>

            <div className="board-detail-comments">
              {post.comments.map((comment) => (
                <div key={comment.id} className="board-detail-comment">
                  <div className="board-detail-comment-avatar">{comment.authorNickname[0]}</div>
                  <div className="board-detail-comment-body">
                    <div className="board-detail-comment-head">
                      <span className="board-detail-comment-author">{comment.authorNickname}</span>
                      {comment.mine && (
                        <button
                          type="button"
                          className="board-detail-comment-delete"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <div className="board-detail-comment-content">{comment.content}</div>
                  </div>
                </div>
              ))}
              {post.comments.length === 0 && (
                <div className="board-detail-comment-empty">아직 댓글이 없어요. 첫 댓글을 남겨보세요!</div>
              )}
            </div>

            <form className="board-detail-comment-form" onSubmit={handleAddComment}>
              <input
                type="text"
                value={commentValue}
                onChange={(e) => setCommentValue(e.target.value)}
                placeholder="댓글을 입력해주세요"
                maxLength={500}
              />
              <button type="submit" disabled={commentSubmitting || !commentValue.trim()}>
                등록
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
