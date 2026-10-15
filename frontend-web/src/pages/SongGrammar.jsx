import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getSong } from '../api/songs'
import TopBar from '../components/TopBar'
import './SongLearn.css'

// 곡 전체의 문법 포인트만 모아서 보여주는 전용 화면 — claude/소셜_마이페이지_기획.md 24-6번.
// SongLearn.jsx "이 소절의 단어" 아래 "문법 보기" 버튼으로 들어온다. 곡 상세(getSong)가
// 이미 grammarPoints를 포함해서 내려주므로 별도 API가 필요 없다 — SongLearn.css의 카드
// 스타일(.song-learn-grammar-*)을 그대로 재사용한다.
export default function SongGrammar() {
  const { t } = useTranslation('song')
  const { id } = useParams()
  const navigate = useNavigate()

  const [song, setSong] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getSong(id)
      .then((data) => {
        if (cancelled) return
        setSong(data)
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

  const lineById = {}
  if (song?.lines) {
    for (const line of song.lines) {
      lineById[line.id] = line
    }
  }

  return (
    <div className="song-learn-page">
      <TopBar showSearch={false} />
      <div className="app-subbar">
        <button className="app-subbar-back" onClick={() => navigate(-1)} aria-label={t('common:actions.back')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span className="app-subbar-title">{t('grammar.title')}</span>
      </div>

      {loading ? (
        <div className="song-learn-status">{t('common:actions.loading')}</div>
      ) : error ? (
        <div className="song-learn-status song-learn-status--error">
          {t('loadError')}
        </div>
      ) : !song ? null : (
        <div className="song-learn-content">
          <div className="song-grammar-shell">
            <h1 className="song-grammar-title">{song.title}</h1>
            <p className="song-grammar-artist">{song.artist}</p>

            {song.grammarPoints?.length > 0 ? (
              <div className="song-learn-grammar-list">
                {song.grammarPoints.map((gp) => {
                  const exampleLine = gp.exampleLineId ? lineById[gp.exampleLineId] : null
                  return (
                    <div key={gp.id} className="song-learn-grammar-card">
                      <span className="song-learn-grammar-pattern">{gp.pattern}</span>
                      <p className="song-learn-grammar-explanation">{gp.explanation}</p>
                      {exampleLine && (
                        <div className="song-grammar-example">
                          <span className="song-grammar-example-original">{exampleLine.originalText}</span>
                          <span className="song-grammar-example-translation">{exampleLine.translationNatural}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="song-learn-status">{t('grammar.empty')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
