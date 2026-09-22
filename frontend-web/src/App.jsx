import { useEffect, useState } from 'react'
import { getHealth } from './api/client'
import './App.css'

function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    getHealth()
      .then((data) => setStatus(`backend ok (${data.timestamp})`))
      .catch(() => setStatus('backend에 연결하지 못했습니다. 백엔드가 실행 중인지 확인하세요.'))
  }, [])

  return (
    <main className="app">
      <h1>우타고 (Utago)</h1>
      <p>좋아하는 노래의 가사를 통해 언어를 공부하는 앱</p>
      <p className="status">backend status: {status}</p>
    </main>
  )
}

export default App
