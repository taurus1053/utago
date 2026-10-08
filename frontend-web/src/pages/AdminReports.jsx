import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getMyRole, listReports, resolveReport } from '../api/admin'
import './AdminTranslations.css'

// 관리자 전용 "신고 관리" 화면 — claude/소셜_마이페이지_기획.md 23번. 게시글/댓글 신고를
// 한 화면에서 훑어보고 처리한다(기각 / 콘텐츠 삭제 / 작성자 경고 / 작성자 정지).
// 디자인은 다른 관리자 화면(AdminFeaturedSongs.jsx)과 같은 AdminTranslations.css 클래스를
// 그대로 재사용했다.

const REASON_LABEL = { SPAM: '스팸/광고', ABUSE: '욕설/비방', ADULT: '음란물', COPYRIGHT: '저작권 침해', ETC: '기타' }
const STATUS_LABEL = { PENDING: '처리 대기', RESOLVED: '처리 완료', REJECTED: '기각됨' }
const ACTION_LABEL = { NONE: '-', CONTENT_DELETED: '콘텐츠 삭제', AUTHOR_WARNED: '작성자 경고', AUTHOR_SUSPENDED: '작성자 정지' }

const STATUS_TABS = [
  { value: 'PENDING', label: '처리 대기' },
  { value: 'RESOLVED', label: '처리 완료' },
  { value: 'REJECTED', label: '기각됨' },
  { value: '', label: '전체' },
]

// 신고 1건 처리 액션 버튼 묶음 — 정지는 기간 입력이 붙어서 별도 상태로 관리.
function ReportActions({ report, onResolved }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [suspendDays, setSuspendDays] = useState(7)

  async function handle(action) {
    if (busy) return
    if (action === 'CONTENT_DELETED' && !window.confirm('콘텐츠를 삭제할까요? 되돌릴 수 없어요.')) return
    setBusy(true)
    setError(null)
    try {
      const updated = await resolveReport(report.id, action, action === 'AUTHOR_SUSPENDED' ? suspendDays : null)
      onResolved(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-tr-row-actions" style={{ flexWrap: 'wrap', gap: 6 }}>
      <button type="button" className="admin-tr-btn-ghost" onClick={() => handle('NONE')} disabled={busy}>
        기각
      </button>
      <button type="button" className="admin-tr-btn-ghost" onClick={() => handle('CONTENT_DELETED')} disabled={busy}>
        콘텐츠 삭제
      </button>
      <button type="button" className="admin-tr-btn-ghost" onClick={() => handle('AUTHOR_WARNED')} disabled={busy}>
        작성자 경고
      </button>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number"
          min={1}
          max={365}
          value={suspendDays}
          onChange={(e) => setSuspendDays(Number(e.target.value) || 1)}
          style={{ width: 48, textAlign: 'center' }}
          disabled={busy}
        />
        <span style={{ fontSize: 12, color: '#a89c86' }}>일</span>
        <button type="button" onClick={() => handle('AUTHOR_SUSPENDED')} disabled={busy}>
          {busy ? '처리 중...' : '작성자 정지'}
        </button>
      </span>
      {error && <span className="admin-tr-notice-inline admin-tr-notice-inline--error">{error}</span>}
    </div>
  )
}

export default function AdminReports() {
  const navigate = useNavigate()
  const [access, setAccess] = useState('checking') // checking | ok | denied

  useEffect(() => {
    let alive = true
    getMyRole()
      .then((res) => {
        if (!alive) return
        setAccess(res.role === 'ADMIN' ? 'ok' : 'denied')
      })
      .catch(() => {
        if (alive) setAccess('denied')
      })
    return () => {
      alive = false
    }
  }, [])

  const [status, setStatus] = useState('PENDING')
  const [page, setPage] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function reload(nextStatus = status, nextPage = page) {
    setLoading(true)
    setError(null)
    listReports({ status: nextStatus || undefined, page: nextPage, size: 20 })
      .then(setData)
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (access !== 'ok') return
    reload(status, 0)
    setPage(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, status])

  function handlePage(nextPage) {
    setPage(nextPage)
    reload(status, nextPage)
  }

  function handleResolved(updated) {
    setData((prev) => {
      if (!prev) return prev
      // 처리 대기 탭을 보고 있었으면 방금 처리된 건은 목록에서 바로 사라지는 게 자연스럽다.
      if (status === 'PENDING') {
        return { ...prev, content: prev.content.filter((r) => r.id !== updated.id) }
      }
      return { ...prev, content: prev.content.map((r) => (r.id === updated.id ? updated : r)) }
    })
  }

  if (access === 'checking') {
    return (
      <div className="admin-tr-page">
        <p className="admin-tr-status">권한 확인 중...</p>
      </div>
    )
  }

  if (access === 'denied') {
    return (
      <div className="admin-tr-page">
        <p className="admin-tr-status">
          관리자만 접근할 수 있는 화면이에요.{' '}
          <Link to="/">홈으로 돌아가기 →</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="admin-tr-page">
      <header className="admin-tr-topbar">
        <button className="admin-tr-back" onClick={() => navigate(-1)} aria-label="뒤로 가기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span className="admin-tr-topbar-title">신고 관리</span>
        <Link to="/admin/featured-songs" className="admin-song-nav-link">곡 관리 →</Link>
        <Link to="/admin/translations" className="admin-song-nav-link admin-song-nav-link--plain">번역 캐시 관리 →</Link>
      </header>

      <div className="admin-tr-content">
        <p className="admin-tr-notice">
          게시글/댓글 신고를 처리해요. "기각"은 아무 조치 없이 신고만 닫고, "콘텐츠 삭제"는
          해당 글/댓글을 바로 지워요(되돌릴 수 없음). "작성자 경고"는 해당 유저의 경고
          횟수만 올리고, "작성자 정지"는 지정한 일수만큼 로그인 자체를 막아요.
        </p>

        <section className="admin-tr-section">
          <div className="admin-tr-section-toolbar">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={status === tab.value ? 'admin-tr-btn-ghost' : ''}
                onClick={() => setStatus(tab.value)}
                style={{ marginRight: 6, fontWeight: status === tab.value ? 700 : 400 }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="admin-tr-status" style={{ marginTop: 8 }}>불러오는 중...</p>
          ) : error ? (
            <p className="admin-tr-status" style={{ marginTop: 8 }}>목록을 불러오지 못했어요.</p>
          ) : !data || data.content.length === 0 ? (
            <p className="admin-tr-status" style={{ marginTop: 8 }}>해당하는 신고가 없어요.</p>
          ) : (
            <>
              <div className="admin-tr-table" style={{ marginTop: 10 }}>
                {data.content.map((report) => (
                  <div className="admin-tr-row" key={report.id}>
                    <div className="admin-tr-row-meta">
                      <span className="admin-tr-badge">{report.targetType === 'POST' ? '게시글' : '댓글'}</span>
                      <span className="admin-tr-badge">{REASON_LABEL[report.reason] ?? report.reason}</span>
                      {report.targetDeleted && <span className="admin-tr-badge admin-tr-badge--ai">삭제됨</span>}
                      <span className="admin-tr-badge admin-tr-badge--ai">{STATUS_LABEL[report.status] ?? report.status}</span>
                    </div>
                    <div className="admin-tr-row-original">
                      "{report.targetSnapshot}" — 작성자 {report.targetAuthorNickname}
                    </div>
                    <div className="admin-tr-row-genre-label" style={{ fontSize: 12.5, color: '#a89c86' }}>
                      신고자 {report.reporterNickname}
                      {report.detail && ` · ${report.detail}`}
                    </div>
                    {report.status !== 'PENDING' && (
                      <div style={{ fontSize: 12.5, color: '#a89c86' }}>
                        처리 결과: {ACTION_LABEL[report.action] ?? report.action}
                      </div>
                    )}
                    {report.status === 'PENDING' && <ReportActions report={report} onResolved={handleResolved} />}
                  </div>
                ))}
              </div>
              <div className="admin-tr-pagination" style={{ marginTop: 4 }}>
                <button type="button" disabled={data.first} onClick={() => handlePage(page - 1)}>← 이전</button>
                <span>{data.number + 1} / {Math.max(data.totalPages, 1)} 페이지 (총 {data.totalElements}건)</span>
                <button type="button" disabled={data.last} onClick={() => handlePage(page + 1)}>다음 →</button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
