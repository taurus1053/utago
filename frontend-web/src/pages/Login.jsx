import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { login } from '../api/auth'
import { ApiError } from '../api/client'
import './Login.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from ?? '/'
  // 랜딩 페이지의 전환 애니메이션을 타고 들어왔을 때만 로고/문구를 서서히
  // 페이드인 시킨다. 뒤로가기/앞으로가기나 새로고침으로 바로 들어왔을 땐
  // 애니메이션 없이 즉시 보여준다.
  const fromTransition = Boolean(location.state?.fromTransition)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleNotice, setGoogleNotice] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('이메일과 비밀번호를 모두 입력해주세요.')
      return
    }

    setSubmitting(true)
    try {
      await login(email, password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      {/* 좌측 브랜드 패널 */}
      <div className="login-brand">
        <div className="login-brand-circle login-brand-circle--top" />
        <div className="login-brand-circle login-brand-circle--bottom" />
        <img
          src="/utago-logo.png"
          alt="UTAGO"
          className={`login-logo${fromTransition ? ' login-logo--animate' : ''}`}
        />
        <div className={`login-tagline${fromTransition ? ' login-tagline--animate' : ''}`}>
          좋아하는 노래로,
          <br />
          새로운 언어를 배우다
        </div>
      </div>

      {/* 우측 폼 */}
      <div className="login-form-area">
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-heading">
            <span className="login-title">로그인</span>
          </div>

          <div className="login-fields">
            <label className="login-field">
              <span className="login-label">이메일</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>

            <label className="login-field">
              <span className="login-label">비밀번호</span>
              <input
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
          </div>

          {error && <div className="login-error" role="alert">{error}</div>}

          <div className="login-forgot-row">
            <a href="#" className="login-forgot-link">비밀번호를 잊으셨나요?</a>
          </div>

          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? '로그인 중...' : '로그인'}
          </button>

          <div className="login-divider">
            <div className="login-divider-line" />
            <span>또는</span>
            <div className="login-divider-line" />
          </div>

          <button
            type="button"
            className="login-google"
            onClick={() => setGoogleNotice(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.15-4.05 1.15-3.11 0-5.75-2.1-6.69-4.93H1.3v3.09A12 12 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.31 14.31A7.2 7.2 0 0 1 4.93 12c0-.8.14-1.58.38-2.31V6.6H1.3A12 12 0 0 0 0 12c0 1.94.46 3.77 1.3 5.4l4.01-3.09z" />
              <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.3 6.6l4.01 3.09C6.25 6.85 8.89 4.75 12 4.75z" />
            </svg>
            구글로 계속하기
          </button>
          {googleNotice && (
            <div className="login-google-notice">구글 로그인은 아직 준비 중이에요.</div>
          )}

          <div className="login-signup-row">
            계정이 없으신가요? <Link to="/signup" className="login-signup-link">회원가입</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
