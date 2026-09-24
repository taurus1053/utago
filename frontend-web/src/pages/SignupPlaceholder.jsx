import { Link } from 'react-router-dom'
import './Home.css'

// 회원가입 화면은 다음 단계에서 디자인(Signup.dc.html)대로 구현 예정.
// 로그인 화면에서 링크가 끊기지 않도록 두는 임시 자리표시자.
export default function SignupPlaceholder() {
  return (
    <div className="home-page">
      <h1>회원가입</h1>
      <p className="home-note">회원가입 화면은 다음 단계에서 만들 예정입니다.</p>
      <Link to="/login">로그인으로 돌아가기</Link>
    </div>
  )
}
