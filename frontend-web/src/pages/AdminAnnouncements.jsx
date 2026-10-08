import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getMyRole, sendAnnouncement } from '../api/admin'
import './AdminTranslations.css'

// 관리자 전용 "운영진 공지" 발송 화면 — claude/소셜_마이페이지_기획.md 24번. 텍스트 하나를
// 입력해 보내면 전체 사용자에게 알림이 한 번에 뿌려진다(되돌릴 수 없음). 다른 관리자 화면과
// 같은 AdminTranslations.css 클래스를 재사용했다.
export default function AdminAnnouncements() {
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

  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  async function handleSend(e) {
    e.preventDefault()
    if (!message.trim() || sending) return
    if (!window.confirm('전체 사용자에게 공지 알림을 보낼까요? 되돌릴 수 없어요.')) return
    setSending(true)
    setError(null)
    setSent(false)
    try {
      await sendAnnouncement(message.trim())
      setMessage('')
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
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
        <span className="admin-tr-topbar-title">운영진 공지</span>
        <Link to="/admin/reports" className="admin-song-nav-link">신고 관리 →</Link>
        <Link to="/admin/featured-songs" className="admin-song-nav-link admin-song-nav-link--plain">곡 관리 →</Link>
      </header>

      <div className="admin-tr-content">
        <p className="admin-tr-notice">
          입력한 내용으로 전체 사용자에게 알림이 하나씩 전송돼요(상단바 종 아이콘). 보낸
          공지는 취소할 수 없으니 내용을 한 번 더 확인해주세요.
        </p>

        <section className="admin-tr-section">
          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="공지 내용을 입력해주세요"
              maxLength={500}
              rows={5}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid #ececec',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="submit" disabled={sending || !message.trim()}>
                {sending ? '보내는 중...' : '전체 공지 보내기'}
              </button>
              {sent && <span className="admin-tr-notice-inline admin-tr-notice-inline--success">공지를 보냈어요.</span>}
              {error && <span className="admin-tr-notice-inline admin-tr-notice-inline--error">{error}</span>}
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
