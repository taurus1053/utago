import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  requestSignupCode,
  verifySignupCode,
  signup as signupApi,
  checkNickname as checkNicknameApi,
  login,
} from '../api/auth'
import { ApiError } from '../api/client'
import DatePicker from '../components/DatePicker'
import { startPageTransition } from '../utils/pageTransition'
import { getLastKnownLandingHeroRect } from '../utils/landingHeroRect'
import './Signup.css'

const NATIVE_LANGS = [
  { value: 'KO', label: '한국어' },
  { value: 'JA', label: '日本語' },
  { value: 'EN', label: 'English' },
]

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,20}$/
const NICKNAME_PATTERN = /^[a-zA-Z0-9가-힣぀-ゟ゠-ヿ一-鿿]{2,12}$/

export default function Signup() {
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState('verify') // verify -> form -> done
  const brandRef = useRef(null)

  // 랜딩 페이지의 전환 애니메이션을 타고 들어왔을 때만 로고/문구를 서서히
  // 페이드인 시킨다. 뒤로가기/앞으로가기나 새로고침으로 바로 들어왔을 땐
  // 애니메이션 없이 즉시 보여줘야 "왜 이렇게 느리지" 하는 느낌이 없다.
  const fromTransition = Boolean(location.state?.fromTransition)

  // Login.jsx의 뒤로가기와 똑같은 전환(화면을 채웠다가 랜딩의 실제 히어로 크기로
  // 모여듦)을 그대로 재사용한다(2026-10-07 피드백 — 회원가입 페이지에도 뒤로가기가
  // 필요하다는 요청). utils/landingHeroRect.js가 기억해둔 실제 히어로 크기를 쓴다.
  function handleBack() {
    const rect = brandRef.current
      ? brandRef.current.getBoundingClientRect()
      : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
    startPageTransition(rect, '/', {
      replace: true,
      variant: 'hero',
      getShrinkRect: getLastKnownLandingHeroRect,
    })
  }

  return (
    <div className="signup-page">
      <div className="signup-brand" ref={brandRef}>
        <div className="signup-brand-circle signup-brand-circle--top" />
        <div className="signup-brand-circle signup-brand-circle--bottom" />
        <img
          src="/utago-logo.png"
          alt="UTAGO"
          className={`signup-logo${fromTransition ? ' signup-logo--animate' : ''}`}
        />
        <div className={`signup-tagline${fromTransition ? ' signup-tagline--animate' : ''}`}>
          <div className="signup-tagline-main">
            좋아하는 노래로,
            <br />
            새로운 언어를 배우다
          </div>
        </div>
      </div>

      <div className="signup-form-area">
        <button type="button" className="signup-back-btn" onClick={handleBack}>
          <span className="signup-back-arrow">&lt;</span> 뒤로가기
        </button>
        {step === 'verify' && <VerifyStep onVerified={() => setStep('form')} />}
        {step === 'form' && (
          <FormStep onDone={() => setStep('done')} navigate={navigate} />
        )}
        {step === 'done' && <DoneStep navigate={navigate} />}
      </div>
    </div>
  )
}

// ---------------- 1단계: 이메일 인증 ----------------

function VerifyStep({ onVerified }) {
  const [email, setEmail] = useState('')
  const [emailSubmitted, setEmailSubmitted] = useState(false)
  const [codeRequested, setCodeRequested] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState('')

  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [codeSubmitted, setCodeSubmitted] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resent, setResent] = useState(false)

  const inputRefs = useRef([])

  const showEmailError = emailSubmitted && !email.trim()

  async function handleRequestCode() {
    setRequestError('')
    if (!email.trim()) {
      setEmailSubmitted(true)
      return
    }
    setRequesting(true)
    try {
      await requestSignupCode(email.trim())
      setCodeRequested(true)
    } catch (err) {
      setRequestError(err instanceof ApiError ? err.message : '인증코드 발송에 실패했습니다.')
    } finally {
      setRequesting(false)
    }
  }

  function handleChangeEmail() {
    setCodeRequested(false)
    setDigits(['', '', '', '', '', ''])
    setCodeSubmitted(false)
    setResent(false)
    setVerifyError('')
  }

  function setDigitAt(index, value) {
    const digit = value.replace(/[^0-9]/g, '').slice(-1)
    setDigits((prev) => {
      const next = [...prev]
      next[index] = digit
      return next
    })
    setCodeSubmitted(false)
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const pasted = text.replace(/[^0-9]/g, '').slice(0, 6).split('')
    if (!pasted.length) return
    const next = ['', '', '', '', '', '']
    pasted.forEach((d, i) => {
      next[i] = d
    })
    setDigits(next)
    setCodeSubmitted(false)
    const focusIndex = Math.min(pasted.length, 5)
    inputRefs.current[focusIndex]?.focus()
  }

  const showCodeError = codeSubmitted && digits.join('').length !== 6 && !verifyError

  async function handleSubmitCode() {
    setCodeSubmitted(true)
    setVerifyError('')
    const code = digits.join('')
    if (code.length !== 6) return

    setVerifying(true)
    try {
      await verifySignupCode(email.trim(), code)
      // 2단계(폼)에서 이메일을 다시 물어보지 않도록 인증된 이메일을 잠깐 보관해둔다.
      sessionStorage.setItem('utago_signup_email', email.trim())
      onVerified()
    } catch (err) {
      setVerifyError(err instanceof ApiError ? err.message : '인증에 실패했습니다.')
    } finally {
      setVerifying(false)
    }
  }

  async function handleResend() {
    setResent(false)
    try {
      await requestSignupCode(email.trim())
      setResent(true)
    } catch (err) {
      setRequestError(err instanceof ApiError ? err.message : '인증코드 재전송에 실패했습니다.')
    }
  }

  return (
    <div className="signup-form">
      <div className="signup-heading">
        <span className="signup-title-lg">회원가입</span>
        <span className="signup-title">사용하실 이메일을 입력해주세요</span>
      </div>

      <label className="signup-field">
        <span className="signup-label">이메일</span>
        <div className="signup-row">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            disabled={codeRequested}
            onChange={(e) => setEmail(e.target.value)}
            className={showEmailError ? 'has-error' : ''}
          />
          {!codeRequested ? (
            <button
              type="button"
              className="signup-btn-accent"
              onClick={handleRequestCode}
              disabled={requesting}
            >
              {requesting ? '전송 중...' : '인증코드 받기'}
            </button>
          ) : (
            <button type="button" className="signup-btn-outline" onClick={handleChangeEmail}>
              변경
            </button>
          )}
        </div>
        {showEmailError && <span className="signup-error-text">이메일 입력은 필수입니다.</span>}
        {requestError && <span className="signup-error-text">{requestError}</span>}
      </label>

      {codeRequested && (
        <>
          <div className="signup-field">
            <span className="signup-label">인증코드</span>
            <div className="signup-code-row" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => setDigitAt(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className={showCodeError || verifyError ? 'has-error' : ''}
                />
              ))}
            </div>
            {showCodeError && <span className="signup-error-text">인증코드를 입력해주세요.</span>}
            {verifyError && <span className="signup-error-text">{verifyError}</span>}
          </div>

          <button type="button" className="signup-submit" onClick={handleSubmitCode} disabled={verifying}>
            {verifying ? '확인 중...' : '인증하고 계속하기'}
          </button>

          <div className="signup-muted-row">
            코드를 못 받으셨나요?{' '}
            <a href="#" className="signup-link" onClick={(e) => { e.preventDefault(); handleResend() }}>
              재전송
            </a>
            {resent && <span className="signup-success-text"> · 재전송했어요</span>}
          </div>
        </>
      )}

      <div className="signup-muted-row">
        이미 계정이 있으신가요? <Link to="/login" className="signup-link">로그인</Link>
      </div>
    </div>
  )
}

// ---------------- 2단계: 나머지 정보 입력 ----------------

function FormStep({ onDone, navigate }) {
  // step 1에서 인증까지 끝난 이메일. 이 컴포넌트 자체는 이메일을 모르므로
  // 부모가 넘겨주는 대신, verify-signup-code 가 이미 서버에 verified=true 로
  // 기록해뒀기 때문에 signup() 호출 시점에 이메일 값만 다시 넘기면 된다.
  // (간단하게 유지하기 위해 App state 대신 로컬 state로 이메일을 들고 있는다.)
  return <FormStepInner onDone={onDone} navigate={navigate} />
}

function FormStepInner({ onDone, navigate }) {
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [nickname, setNickname] = useState('')
  const [nicknameChecked, setNicknameChecked] = useState(false)
  const [nicknameAvailable, setNicknameAvailable] = useState(false)
  const [nicknameFormatError, setNicknameFormatError] = useState(false)
  const [checkingNickname, setCheckingNickname] = useState(false)
  const [nativeLang, setNativeLang] = useState('KO')
  const [birthDate, setBirthDate] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const passwordOk = password.trim().length > 0
  const confirmOk = passwordConfirm.trim().length > 0
  const passwordMatch = password === passwordConfirm
  const passwordFormatOk = PASSWORD_PATTERN.test(password)

  const showPasswordError = submitted && !passwordOk
  const showPasswordFormatError = submitted && passwordOk && !passwordFormatOk
  const showPasswordConfirmError = submitted && !confirmOk
  // 제출 여부와 상관없이, 확인란에 뭔가 입력된 순간부터 바로바로 대조해서 보여준다.
  const showPasswordMismatch = confirmOk && passwordMatch === false

  // 비밀번호 확인란 아래 상태 문구. 항상 한 줄을 차지해서(빈 문구라도)
  // 문구가 생겼다 사라질 때 아래 요소들이 밀리지 않게 한다.
  let confirmStatus
  if (submitted && !confirmOk) {
    confirmStatus = { text: '비밀번호 확인은 필수입니다.', className: 'signup-confirm-status--error' }
  } else if (!confirmOk) {
    confirmStatus = { text: '', className: '' }
  } else if (!passwordMatch) {
    confirmStatus = { text: '비밀번호가 일치하지 않습니다.', className: 'signup-confirm-status--error' }
  } else {
    confirmStatus = { text: '비밀번호가 일치합니다.', className: 'signup-confirm-status--ok' }
  }
  const showNicknameFormatError = nicknameFormatError
  const showNicknameCheckError = submitted && !nicknameChecked && !showNicknameFormatError
  const showNicknameAvailable = nicknameChecked && nicknameAvailable && !showNicknameFormatError

  function handleNicknameChange(value) {
    const filtered = value.replace(/[^a-zA-Z0-9가-힣぀-ゟ゠-ヿ一-鿿]/g, '').slice(0, 12)
    setNickname(filtered)
    setNicknameChecked(false)
    setNicknameAvailable(false)
    setNicknameFormatError(false)
  }

  async function handleCheckNickname() {
    const value = nickname.trim()
    if (!NICKNAME_PATTERN.test(value)) {
      setNicknameChecked(false)
      setNicknameFormatError(true)
      return
    }
    setNicknameFormatError(false)
    setCheckingNickname(true)
    try {
      const res = await checkNicknameApi(value)
      setNicknameChecked(true)
      setNicknameAvailable(Boolean(res.available))
    } catch {
      setNicknameChecked(false)
    } finally {
      setCheckingNickname(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
    setSubmitError('')

    const nicknameOk = nicknameChecked && nicknameAvailable && !nicknameFormatError
    if (!passwordOk || !passwordFormatOk || !confirmOk || !passwordMatch || !nicknameOk) {
      return
    }

    // verify-signup-code 단계에서 입력했던 이메일. localStorage 등에 별도 저장하지 않고
    // 세션 스토리지에 임시로 들고 있다가 signup 시점에 사용한다.
    const email = sessionStorage.getItem('utago_signup_email') || ''

    setSubmitting(true)
    try {
      await signupApi({ email, password, nickname, nativeLang, birthDate: birthDate || null })
      // 가입 직후 자동 로그인 시도 (실패해도 가입 자체는 완료된 상태).
      try {
        await login(email, password)
      } catch {
        // 자동 로그인 실패는 무시하고 완료 화면에서 로그인 화면으로 보낸다.
      }
      sessionStorage.removeItem('utago_signup_email')
      onDone()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : '가입 중 문제가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="signup-form signup-form--wide" onSubmit={handleSubmit} noValidate>
      <div className="signup-heading">
        <span className="signup-title-lg">회원가입</span>
        <span className="signup-subtitle">이메일 인증 완료! 몇 가지만 더 입력해주세요</span>
      </div>

      <div className="signup-fields">
        <label className="signup-field">
          <span className="signup-label">이메일</span>
          <div className="signup-email-locked">
            <span>{sessionStorage.getItem('utago_signup_email') || ''}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2f9e5c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </label>

        <label className="signup-field">
          <span className="signup-label">비밀번호</span>
          <input
            type="password"
            placeholder="8~20자, 영문 대/소문자+숫자+특수기호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={showPasswordError || showPasswordFormatError ? 'has-error' : ''}
          />
          {showPasswordError && <span className="signup-error-text">비밀번호 입력은 필수입니다.</span>}
          {showPasswordFormatError && (
            <span className="signup-error-text">8~20자, 영문 대/소문자+숫자+특수기호를 모두 포함해주세요.</span>
          )}
          {!showPasswordError && !showPasswordFormatError && (
            <span className="signup-hint-text">8~20자 · 영문 대문자·소문자·숫자·특수기호 모두 포함</span>
          )}
        </label>

        <label className="signup-field">
          <span className="signup-label">비밀번호 확인</span>
          <input
            type="password"
            placeholder="비밀번호를 다시 입력하세요"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className={showPasswordConfirmError || showPasswordMismatch ? 'has-error' : ''}
          />
          {/* 항상 한 줄을 차지해서, 문구가 생겼다 사라져도 아래 요소들 위치가 안 움직이게 한다. */}
          <span className={`signup-confirm-status ${confirmStatus.className}`}>{confirmStatus.text}</span>
        </label>

        <label className="signup-field">
          <span className="signup-label">닉네임</span>
          <div className="signup-row">
            <input
              type="text"
              maxLength={12}
              placeholder="다른 사람에게 보여질 이름"
              value={nickname}
              onChange={(e) => handleNicknameChange(e.target.value)}
              className={showNicknameFormatError || showNicknameCheckError ? 'has-error' : ''}
            />
            <button
              type="button"
              className="signup-btn-light-accent"
              onClick={handleCheckNickname}
              disabled={checkingNickname}
            >
              {checkingNickname ? '확인 중...' : '중복확인'}
            </button>
          </div>
          {showNicknameFormatError && (
            <span className="signup-error-text">2~12자, 한글·영문·일본어·숫자만 사용할 수 있습니다.</span>
          )}
          {!showNicknameFormatError && showNicknameCheckError && (
            <span className="signup-error-text">중복 확인은 필수입니다.</span>
          )}
          {!showNicknameFormatError && nicknameChecked && !nicknameAvailable && (
            <span className="signup-error-text">이미 사용 중인 닉네임입니다.</span>
          )}
          {showNicknameAvailable && <span className="signup-success-text">사용 가능한 닉네임입니다.</span>}
          {!showNicknameFormatError && !showNicknameCheckError && !nicknameChecked && (
            <span className="signup-hint-text">2~12자 · 한글·영문·일본어·숫자만 (특수문자 제외)</span>
          )}
        </label>

        <div className="signup-field">
          <span className="signup-label">모국어</span>
          <div className="signup-lang-row">
            {NATIVE_LANGS.map((lang) => (
              <button
                key={lang.value}
                type="button"
                className={`signup-lang-pill ${nativeLang === lang.value ? 'is-active' : ''}`}
                onClick={() => setNativeLang(lang.value)}
              >
                {lang.label}
              </button>
            ))}
          </div>
          <span className="signup-hint-text">나중에 설정에서 바꿀 수 있어요</span>
        </div>

        <label className="signup-field">
          <span className="signup-label">
            생년월일 <span className="signup-optional">(선택)</span>
          </span>
          <DatePicker value={birthDate} onChange={setBirthDate} />
        </label>
      </div>

      {submitError && <div className="signup-banner-error">{submitError}</div>}

      <button type="submit" className="signup-submit" disabled={submitting}>
        {submitting ? '가입 처리 중...' : '가입하기'}
      </button>
    </form>
  )
}

// ---------------- 3단계: 완료 ----------------

function DoneStep({ navigate }) {
  const { isLoggedIn } = requireAuthCheck()

  return (
    <div className="signup-done">
      <div className="signup-done-icon">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#7636F6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <span className="signup-done-title">가입이 완료됐어요!</span>
      <span className="signup-done-sub">
        이제 좋아하는 노래로
        <br />
        언어 공부를 시작해보세요
      </span>
      <button
        type="button"
        className="signup-submit signup-done-btn"
        onClick={() => navigate(isLoggedIn ? '/' : '/login', { replace: true })}
      >
        홈으로 가기
      </button>
    </div>
  )
}

function requireAuthCheck() {
  // 가입 직후 자동 로그인이 성공했으면 토큰이 저장되어 있다.
  return { isLoggedIn: Boolean(localStorage.getItem('utago_token')) }
}
