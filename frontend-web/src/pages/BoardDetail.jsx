import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar'
import ReportModal from '../components/ReportModal'
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
  const { t } = useTranslation('board')
  const { id } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [commentValue, setCommentValue] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [downloadState, setDownloadState] = useState('idle') // idle | busy | done | error
  const [downloadError, setDownloadError] = useState(null)
  // 신고 모달 대상 — null이면 닫힘, { type: 'POST'|'COMMENT', id }면 열림(claude/
  // 소셜_마이페이지_기획.md 23번). 신고 접수 후 다시 신고 못 누르게 막진 않는다(서버가
  // 이미 PENDING 신고 중복은 막아줌 — ReportService.createReport 참고).
  const [reportTarget, setReportTarget] = useState(null)
  const [reportDone, setReportDone] = useState(false)
  // 답글(대댓글, claude/소셜_마이페이지_기획.md 24번) — 어느 최상위 댓글에 답글 입력창이
  // 열려있는지만 들고 있는다(1단계 깊이만 허용하므로 답글에는 답글 버튼 자체가 없음).
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyValue, setReplyValue] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function load() {
    setLoading(true)
    setError(null)
    getPost(id)
      .then(setPost)
      .catch(() => setError(t('loadError')))
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
      setDownloadError(err instanceof ApiError ? err.message : t('detail.downloadFailed'))
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

  async function handleAddReply(e, parentCommentId) {
    e.preventDefault()
    if (!replyValue.trim() || replySubmitting) return
    setReplySubmitting(true)
    try {
      const reply = await addComment(post.id, replyValue.trim(), parentCommentId)
      setPost((prev) => ({
        ...prev,
        comments: [...prev.comments, reply],
        commentCount: prev.commentCount + 1,
      }))
      setReplyValue('')
      setReplyingTo(null)
    } catch {
      // 실패하면 입력값은 그대로 남겨둬서 다시 시도할 수 있게 한다.
    } finally {
      setReplySubmitting(false)
    }
  }

  async function handleDeleteComment(commentId) {
    if (!window.confirm(t('detail.confirmDeleteComment'))) return
    try {
      await deleteComment(post.id, commentId)
      setPost((prev) => {
        // 답글(대댓글)이 달린 댓글을 지우면 서버가 그 답글들도 같이 지운다(ON DELETE
        // CASCADE) — 화면에서도 같이 빼고, 그만큼 commentCount도 더 깎는다.
        const repliesCount = prev.comments.filter((c) => c.parentCommentId === commentId).length
        return {
          ...prev,
          comments: prev.comments.filter((c) => c.id !== commentId && c.parentCommentId !== commentId),
          commentCount: Math.max(0, prev.commentCount - 1 - repliesCount),
        }
      })
    } catch {
      // 실패하면 목록이 그대로 남는다.
    }
  }

  async function handleDeletePost() {
    if (!window.confirm(t('detail.confirmDeletePost'))) return
    try {
      await deletePost(post.id)
      navigate('/board')
    } catch {
      alert(t('detail.deletePostFailed'))
    }
  }

  return (
    <div className="board-detail-page">
      <TopBar showSearch={false} />

      <div className="board-detail-shell">
        {loading ? (
          <div className="board-detail-status">{t('common:actions.loading')}</div>
        ) : error || !post ? (
          <div className="board-detail-status board-detail-status--error">{error || t('detail.notFound')}</div>
        ) : (
          <>
            <button type="button" className="board-detail-back-link" onClick={() => navigate('/board')}>
              {t('detail.back')}
            </button>

            <h1 className="board-detail-title">{post.title}</h1>

            <div className="board-detail-top">
              <div className="board-detail-author-avatar">{post.authorNickname?.[0]}</div>
              <span className="board-detail-author">{post.authorNickname}</span>
              {post.official && <span className="board-detail-badge">{t('official')}</span>}
              <span className="board-detail-dot">·</span>
              <span className="board-detail-date">{formatDate(post.createdAt)}</span>
              {post.mine ? (
                <button type="button" className="board-detail-delete-link" onClick={handleDeletePost}>
                  {t('detail.delete')}
                </button>
              ) : (
                <button
                  type="button"
                  className="board-detail-delete-link"
                  onClick={() => setReportTarget({ type: 'POST', id: post.id })}
                >
                  {t('detail.report')}
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
                    {t('wordCount', { count: post.wordbookItemCount })} · {t('detail.downloads', { count: post.wordbookDownloadCount })}
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
                {downloadState === 'done' ? t('detail.downloadDone') : downloadState === 'busy' ? t('detail.downloadBusy') : t('detail.download')}
              </button>
            </div>
            {downloadError && <div className="board-detail-download-error">{downloadError}</div>}

            <div className="board-detail-actions">
              <button
                type="button"
                className={`board-detail-like-btn${post.likedByMe ? ' board-detail-like-btn--active' : ''}`}
                onClick={handleLike}
              >
                {post.likedByMe ? '♥' : '♡'} {t('detail.like', { count: post.likeCount })}
              </button>
              <span className="board-detail-comment-count">💬 {t('detail.comments', { count: post.commentCount })}</span>
              <button
                type="button"
                className={`board-detail-save-btn${post.savedByMe ? ' board-detail-save-btn--active' : ''}`}
                onClick={handleSave}
                aria-pressed={post.savedByMe}
                aria-label={post.savedByMe ? t('detail.unsave') : t('detail.save')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={post.savedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
              </button>
            </div>

            <div className="board-detail-comments">
              {/* 답글(대댓글, claude/소셜_마이페이지_기획.md 24번) — 1단계 깊이만 허용하므로
                  최상위 댓글 아래 그 댓글의 답글만 들여써서 보여준다. */}
              {post.comments
                .filter((comment) => !comment.parentCommentId)
                .map((comment) => {
                  const replies = post.comments.filter((c) => c.parentCommentId === comment.id)
                  return (
                    <div key={comment.id} className="board-detail-comment-group">
                      <div className="board-detail-comment">
                        <div className="board-detail-comment-avatar">{comment.authorNickname[0]}</div>
                        <div className="board-detail-comment-body">
                          <div className="board-detail-comment-head">
                            <span className="board-detail-comment-author">{comment.authorNickname}</span>
                            {comment.mine ? (
                              <button
                                type="button"
                                className="board-detail-comment-delete"
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                {t('detail.delete')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="board-detail-comment-delete"
                                onClick={() => setReportTarget({ type: 'COMMENT', id: comment.id })}
                              >
                                {t('detail.report')}
                              </button>
                            )}
                          </div>
                          <div className="board-detail-comment-content">{comment.content}</div>
                          <button
                            type="button"
                            className="board-detail-comment-reply-toggle"
                            onClick={() => {
                              setReplyingTo((prev) => (prev === comment.id ? null : comment.id))
                              setReplyValue('')
                            }}
                          >
                            {t('detail.reply')}
                          </button>
                        </div>
                      </div>

                      {replies.map((reply) => (
                        <div key={reply.id} className="board-detail-comment board-detail-comment--reply">
                          <div className="board-detail-comment-avatar">{reply.authorNickname[0]}</div>
                          <div className="board-detail-comment-body">
                            <div className="board-detail-comment-head">
                              <span className="board-detail-comment-author">{reply.authorNickname}</span>
                              {reply.mine ? (
                                <button
                                  type="button"
                                  className="board-detail-comment-delete"
                                  onClick={() => handleDeleteComment(reply.id)}
                                >
                                  {t('detail.delete')}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="board-detail-comment-delete"
                                  onClick={() => setReportTarget({ type: 'COMMENT', id: reply.id })}
                                >
                                  {t('detail.report')}
                                </button>
                              )}
                            </div>
                            <div className="board-detail-comment-content">{reply.content}</div>
                          </div>
                        </div>
                      ))}

                      {replyingTo === comment.id && (
                        <form
                          className="board-detail-reply-form"
                          onSubmit={(e) => handleAddReply(e, comment.id)}
                        >
                          <input
                            type="text"
                            value={replyValue}
                            onChange={(e) => setReplyValue(e.target.value)}
                            placeholder={t('detail.replyPlaceholder')}
                            maxLength={500}
                            autoFocus
                          />
                          <button type="submit" disabled={replySubmitting || !replyValue.trim()}>
                            {t('detail.submitComment')}
                          </button>
                        </form>
                      )}
                    </div>
                  )
                })}
              {post.comments.length === 0 && (
                <div className="board-detail-comment-empty">{t('detail.noComments')}</div>
              )}
            </div>

            <form className="board-detail-comment-form" onSubmit={handleAddComment}>
              <input
                type="text"
                value={commentValue}
                onChange={(e) => setCommentValue(e.target.value)}
                placeholder={t('detail.commentPlaceholder')}
                maxLength={500}
              />
              <button type="submit" disabled={commentSubmitting || !commentValue.trim()}>
                {t('detail.submitComment')}
              </button>
            </form>
          </>
        )}
      </div>

      {reportTarget && (
        <ReportModal
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          onCancel={() => setReportTarget(null)}
          onSubmitted={() => {
            setReportTarget(null)
            setReportDone(true)
            setTimeout(() => setReportDone(false), 2500)
          }}
        />
      )}
      {reportDone && <div className="board-detail-report-toast">{t('detail.reportToast')}</div>}
    </div>
  )
}
