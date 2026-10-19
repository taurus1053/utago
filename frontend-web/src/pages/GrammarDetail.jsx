import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getGrammarDetail, setGrammarLearned } from '../api/grammar'
import { isLoggedIn } from '../api/auth'
import TopBar from '../components/TopBar'
import './Grammar.css'

// 문법 항목 하나의 상세 화면 — claude/기획_정리.md 2026-10-08 신규. 설명/접속 형태/예문 +
// "이 문법이 쓰인 노래"(있으면, 곡별 GrammarPoint와 연결된 것만) + 학습 완료 체크(로그인 필요).
export default function GrammarDetail() {
  const { t } = useTranslation('grammar')
  const { id } = useParams()
  const navigate = useNavigate()
  const loggedIn = isLoggedIn()

  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getGrammarDetail(id)
      .then((data) => {
        if (cancelled) return
        setEntry(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  async function toggleLearned() {
    if (!entry || toggling) return
    setToggling(true)
    try {
      const updated = await setGrammarLearned(entry.id, !entry.learned)
      setEntry(updated)
    } catch {
      // 실패해도 화면 상태는 그대로 — 사용자가 다시 눌러보면 됨.
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="grammar-page">
      <TopBar showSearch={false} />
      <div className="app-subbar">
        <button className="app-subbar-back" onClick={() => navigate(-1)} aria-label={t('common:actions.back')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span className="app-subbar-title">{t('detail.title')}</span>
      </div>

      {loading ? (
        <div className="grammar-status">{t('common:actions.loading')}</div>
      ) : error ? (
        <div className="grammar-status grammar-status--error">{t('detail.loadError')}</div>
      ) : !entry ? null : (
        <div className="grammar-shell">
          <span className="grammar-detail-level">{entry.level}</span>
          <h1 className="grammar-detail-pattern">{entry.pattern}</h1>
          <p className="grammar-detail-meaning">{entry.meaning}</p>

          {entry.structure && (
            <div className="grammar-detail-structure">{entry.structure}</div>
          )}

          <p className="grammar-detail-explanation">{entry.explanation}</p>

          {entry.exampleSentence && (
            <div className="grammar-detail-example">
              <span className="grammar-detail-example-original">{entry.exampleSentence}</span>
              {entry.exampleTranslation && (
                <span className="grammar-detail-example-translation">{entry.exampleTranslation}</span>
              )}
            </div>
          )}

          {loggedIn ? (
            <button
              className={`grammar-learned-btn${entry.learned ? ' grammar-learned-btn--active' : ''}`}
              onClick={toggleLearned}
              disabled={toggling}
            >
              {entry.learned ? t('detail.learned') : t('detail.markLearned')}
            </button>
          ) : (
            <p className="grammar-detail-login-hint">{t('detail.loginHint')}</p>
          )}

          {entry.songs?.length > 0 && (
            <div className="grammar-detail-songs">
              <h2 className="grammar-detail-songs-title">{t('detail.songs')}</h2>
              <div className="grammar-detail-songs-list">
                {entry.songs.map((s) => (
                  <Link key={s.songId} to={`/songs/${s.songId}`} className="grammar-detail-song-item">
                    <span className="grammar-detail-song-title">{s.title}</span>
                    <span className="grammar-detail-song-artist">{s.artist}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
