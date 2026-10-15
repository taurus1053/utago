import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getGrammarList } from '../api/grammar'
import TopBar from '../components/TopBar'
import './Grammar.css'

// 곡과 무관한 "문법 학습" 목록 화면 — claude/기획_정리.md 2026-10-08 신규. 레벨(N5~N1) 탭으로
// 필터링하고, 카드를 누르면 상세 화면(/grammar/:id)으로 이동한다. 로그인 없이도 볼 수 있다
// (학습 완료 체크만 로그인 필요 — GrammarDetail.jsx 참고).
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

export default function GrammarIndex() {
  const { t } = useTranslation('grammar')
  const [level, setLevel] = useState('N5')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getGrammarList(level)
      .then((data) => {
        if (cancelled) return
        setItems(Array.isArray(data) ? data : [])
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
  }, [level])

  return (
    <div className="grammar-page">
      <TopBar showSearch={false} />

      <div className="grammar-shell">
        <h1 className="grammar-title">{t('index.title')}</h1>
        <p className="grammar-subtitle">{t('index.subtitle')}</p>

        <div className="grammar-level-tabs">
          {LEVELS.map((l) => (
            <button
              key={l}
              className={`grammar-level-tab${l === level ? ' grammar-level-tab--active' : ''}`}
              onClick={() => setLevel(l)}
            >
              {l}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grammar-status">{t('common:actions.loading')}</div>
        ) : error ? (
          <div className="grammar-status grammar-status--error">{t('index.loadError')}</div>
        ) : items.length === 0 ? (
          <div className="grammar-status">{t('index.empty')}</div>
        ) : (
          <div className="grammar-list">
            {items.map((item) => (
              <Link key={item.id} to={`/grammar/${item.id}`} className="grammar-card">
                <div className="grammar-card-main">
                  <span className="grammar-card-pattern">{item.pattern}</span>
                  <span className="grammar-card-meaning">{item.meaning}</span>
                </div>
                {item.learned && <span className="grammar-card-badge">{t('index.learned')}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
