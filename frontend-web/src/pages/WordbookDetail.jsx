import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  listWordbookItems,
  listWordbooks,
  removeWordbookItem,
  reviewWordbookItem,
  toggleWordbookItemStar,
} from '../api/wordbook'
import TopBar from '../components/TopBar'
import './WordbookDetail.css'

// 학습횟수(repetitionCount) 구간별 배지 색 — SRS 복습 간격/완료 여부와는 별개로, 단순히
// "이 단어를 몇 번 맞혔는지"를 한눈에 보여주는 용도. 구간이 올라갈수록 파스텔 배경이
// 회색 → 파랑 → 청록 → 초록 → 주황 → 골드로 진해진다.
function repetitionTierClass(count) {
  if (count >= 30) return 'wordbook-detail-badge--tier5'
  if (count >= 20) return 'wordbook-detail-badge--tier4'
  if (count >= 15) return 'wordbook-detail-badge--tier3'
  if (count >= 10) return 'wordbook-detail-badge--tier2'
  if (count >= 5) return 'wordbook-detail-badge--tier1'
  return ''
}

// 단어장 상세 화면 — 담긴 단어 목록(별표/삭제)과, 그 단어들로 하는 플래시카드 복습.
// 로그인 필수 — App.jsx의 RequireAuth가 비로그인 접근을 막는다. 본인 소유가 아닌
// wordbookId면 서버가 403을 내려준다(requireOwnedWordbook).
export default function WordbookDetail() {
  const { t } = useTranslation('wordbook')
  const { id } = useParams()
  const navigate = useNavigate()

  const [bookName, setBookName] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [mode, setMode] = useState('list') // 'list' | 'study'
  const [studyIndex, setStudyIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)

  function refresh() {
    setLoading(true)
    setLoadError(null)
    return Promise.all([listWordbooks(), listWordbookItems(id)])
      .then(([books, itemList]) => {
        const book = (books ?? []).find((b) => String(b.id) === String(id))
        setBookName(book?.name ?? t('detail.defaultName'))
        setItems(itemList ?? [])
      })
      .catch((err) => setLoadError(err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleRemove(itemId) {
    try {
      await removeWordbookItem(itemId)
      setItems((prev) => prev.filter((it) => it.id !== itemId))
    } catch {
      // 실패하면 목록이 그대로 남는다.
    }
  }

  async function handleToggleStar(itemId) {
    try {
      const updated = await toggleWordbookItemStar(itemId)
      setItems((prev) => prev.map((it) => (it.id === itemId ? updated : it)))
    } catch {
      // 실패해도 무시 — 다시 눌러볼 수 있다.
    }
  }

  function startStudy() {
    setStudyIndex(0)
    setRevealed(false)
    setMode('study')
  }

  const currentCard = mode === 'study' ? items[studyIndex] : null

  async function handleReview(know) {
    if (!currentCard) return
    try {
      const updated = await reviewWordbookItem(currentCard.id, know)
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
    } catch {
      // 서버 반영에 실패해도 카드 넘기기는 계속 진행한다 — 복습 흐름이 끊기지 않게.
    }
    setRevealed(false)
    setStudyIndex((i) => i + 1)
  }

  const studyDone = mode === 'study' && studyIndex >= items.length

  return (
    <div className="wordbook-detail-page">
      <TopBar showSearch={false} />
      <div className="app-subbar">
        <button
          className="app-subbar-back"
          onClick={() => (mode === 'study' ? setMode('list') : navigate(-1))}
          aria-label={t('common:actions.back')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span className="app-subbar-title">{bookName}</span>
      </div>

      {loading ? (
        <div className="wordbook-detail-status">{t('common:actions.loading')}</div>
      ) : loadError ? (
        <div className="wordbook-detail-status wordbook-detail-status--error">{t('detail.loadError')}</div>
      ) : mode === 'list' ? (
        <div className="wordbook-detail-content">
          {items.length === 0 ? (
            <div className="wordbook-detail-status">
              {t('detail.empty')}
            </div>
          ) : (
            <>
              <div className="wordbook-detail-header">
                <span className="wordbook-detail-count">{t('wordCount', { count: items.length })}</span>
                <button type="button" className="wordbook-detail-study-btn" onClick={startStudy}>
                  {t('detail.studyBtn')}
                </button>
              </div>
              <div className="wordbook-detail-list">
                {items.map((item) => (
                  <div className="wordbook-detail-row" key={item.id}>
                    <button
                      type="button"
                      className={`wordbook-detail-star${item.starred ? ' wordbook-detail-star--on' : ''}`}
                      onClick={() => handleToggleStar(item.id)}
                      aria-label={item.starred ? t('main.unstar') : t('main.star')}
                    >
                      {item.starred ? '★' : '☆'}
                    </button>
                    <div className="wordbook-detail-row-main">
                      <span className="wordbook-detail-row-word">
                        {item.lemma}
                        {item.reading && <span className="wordbook-detail-row-reading">{item.reading}</span>}
                        <span className={`wordbook-detail-row-lang wordbook-detail-row-lang--${item.lang}`}>{t(`common:langName.${item.lang}`, { defaultValue: item.lang })}</span>
                      </span>
                      <span className="wordbook-detail-row-meaning">
                        {item.meanings && item.meanings.length > 0 ? item.meanings.join(', ') : t('main.meaningPending')}
                      </span>
                    </div>
                    <span className={`wordbook-detail-badge ${repetitionTierClass(item.repetitionCount)}`}>
                      {t('detail.reviewCount', { count: item.repetitionCount })}
                    </span>
                    <button
                      type="button"
                      className="wordbook-detail-remove"
                      onClick={() => handleRemove(item.id)}
                      aria-label={t('main.removeAria')}
                    >
                      {t('common:actions.delete')}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : studyDone ? (
        <div className="wordbook-study-content">
          <div className="wordbook-study-done">
            <span className="wordbook-study-done-emoji">🎉</span>
            <p className="wordbook-study-done-text">{t('detail.done', { count: items.length })}</p>
            <button type="button" className="wordbook-detail-study-btn" onClick={() => setMode('list')}>
              {t('main.toList')}
            </button>
          </div>
        </div>
      ) : (
        <div className="wordbook-study-content">
          <span className="wordbook-study-progress">{studyIndex + 1} / {items.length}</span>
          <div className="wordbook-study-card" onClick={() => setRevealed(true)}>
            <span className="wordbook-study-card-word">{currentCard.lemma}</span>
            {currentCard.reading && <span className="wordbook-study-card-reading">{currentCard.reading}</span>}
            {revealed ? (
              <span className="wordbook-study-card-meaning">
                {currentCard.meanings && currentCard.meanings.length > 0
                  ? currentCard.meanings.join(', ')
                  : t('main.meaningPending')}
              </span>
            ) : (
              <span className="wordbook-study-card-hint">{t('detail.tapToReveal')}</span>
            )}
          </div>
          {revealed && (
            <div className="wordbook-study-actions">
              <button type="button" className="wordbook-study-btn wordbook-study-btn--no" onClick={() => handleReview(false)}>
                {t('detail.dontKnow')}
              </button>
              <button type="button" className="wordbook-study-btn wordbook-study-btn--yes" onClick={() => handleReview(true)}>
                {t('detail.know')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
