import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar'
import { equipTitle, getMyTitles } from '../api/users'
import './MyPage.css'
import './TitlesPage.css'

// 칭호 전체 페이지 — 마이페이지(MyPage.jsx)의 "칭호" 카드 우측 상단 "더보기"로
// 들어온다(claude/소셜_마이페이지_기획.md 15-6번). 마이페이지에서는 보유 칭호를
// 그냥 나열만 하고, 대표 칭호 적용은 여기서만 할 수 있다 — 적용한 대표
// 칭호는 GET /api/users/me의 title로 내려가서 프로필(상태 메시지 옆)에도 붙는다.
//
// 2026-10-08 — 사용자가 가져온 참고 사이트(팀프로젝트 "타노시미")의 칭호 관리 페이지를
// 참고해서 리디자인: 상단에 "현재 대표 칭호" 히어로 카드, 카테고리마다 "달성 X/Y" 진행
// 현황, 달성/미달성을 카드 그리드로 구분해서 보여준다. 같은 날 피드백으로 (1) 잠긴 카드의
// 해금 조건은 클릭이 아니라 "마우스 오버"로만 보이게(모바일은 호버가 없으니 그냥 안 보임),
// (2) 달성한 카드도 호버하면 "몇 XX 달성" 조건을 보여주게, (3) 카드 안 "탭해서 적용" 문구가
// 사라져도 카드 높이가 안 바뀌게, (4) "착용" 대신 "적용"이라는 말을 쓰게, (5) 히어로의
// "변경" 버튼은 스크롤 대신 칭호를 고르는 모달을 띄우게 바꿨다.

const EMPTY_TITLES = { categories: [], equippedTitleCode: null, equippedTitleName: null }

// 카테고리마다 쓰는 아이콘/포인트 컬러 — 백엔드엔 아이콘 필드가 없어서(TitleItemResponse
// 참고) 프론트에서 카테고리 코드로만 매핑한다. 새 카테고리가 추가되면 여기만 보태면 된다.
const CATEGORY_META = {
  WORD: { icon: '📖', color: '#5f26f3' },
  LINE: { icon: '🎤', color: '#d6336c' },
  SONG: { icon: '🎵', color: '#7636f6' },
  WORDBOOK_ADD: { icon: '📚', color: '#0f9d8c' },
  STUDY_TIME: { icon: '⏱️', color: '#e08a1e' },
  STREAK: { icon: '🔥', color: '#e8542f' },
  POST: { icon: '✍️', color: '#2f6fe0' },
  COMMENT: { icon: '💬', color: '#29a35a' },
  WORDBOOK_DOWNLOAD: { icon: '📤', color: '#1f9bd1' },
  MY_POST_COMMENT: { icon: '🗨️', color: '#c0562f' },
  MY_POST_LIKE: { icon: '❤️', color: '#e0415f' },
  WORD_REPEAT: { icon: '🔁', color: '#6a4fd1' },
  SONG_REPEAT: { icon: '🔂', color: '#9b3fc4' },
  // 2026-10-08(2차) 신규 — TitleCategory.java에 추가된 3종(claude/소셜_마이페이지_기획.md 17번).
  DOWNLOAD_RECEIVED: { icon: '📥', color: '#1f8a5c' },
  STUDY_METHOD: { icon: '🎮', color: '#b8650f' },
  TIME_OF_DAY: { icon: '🌗', color: '#4a5fc1' },
  // 2026-10-08(3차) 신규 — 장르별 완곡 칭호(claude/소셜_마이페이지_기획.md 17-8번).
  GENRE: { icon: '🎧', color: '#c4327a' },
}
const DEFAULT_META = { icon: '🌱', color: '#8a7f6e' }

function metaFor(category) {
  return CATEGORY_META[category] || DEFAULT_META
}

export default function TitlesPage() {
  // 아래 칭호 목록 람다들이 인자 이름으로 t를 쓰고 있어서, 번역 함수는 tr로 받는다.
  const { t: tr } = useTranslation('mypage')
  const navigate = useNavigate()
  const [titles, setTitles] = useState(EMPTY_TITLES)
  const [loading, setLoading] = useState(true)
  const [equipping, setEquipping] = useState(null) // 지금 적용 요청 중인 code (버튼 개별 로딩 표시용)
  const [showEquipModal, setShowEquipModal] = useState(false) // 히어로 "변경" 버튼 → 대표 칭호 선택 모달

  function loadTitles() {
    setLoading(true)
    return getMyTitles()
      .then((data) => setTitles(data || EMPTY_TITLES))
      .catch(() => setTitles(EMPTY_TITLES))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTitles()
  }, [])

  async function handleEquip(code) {
    if (equipping) return
    setEquipping(code)
    try {
      const updated = await equipTitle(code)
      setTitles(updated || EMPTY_TITLES)
    } catch {
      // 실패하면(예: 그 사이 조건을 벗어남) 조용히 무시 — 다음에 다시 시도할 수 있다.
    } finally {
      setEquipping(null)
    }
  }

  async function handleEquipFromModal(code) {
    await handleEquip(code)
    setShowEquipModal(false)
  }

  const totalAchieved = titles.categories.reduce(
    (sum, g) => sum + g.titles.filter((t) => t.achieved).length, 0
  )
  const totalCount = titles.categories.reduce((sum, g) => sum + g.titles.length, 0)
  const equippedGroup = titles.categories.find((g) =>
    g.titles.some((t) => t.code === titles.equippedTitleCode)
  )
  const heroMeta = metaFor(equippedGroup?.category)
  const achievableGroups = titles.categories
    .map((g) => ({ ...g, titles: g.titles.filter((t) => t.achieved) }))
    .filter((g) => g.titles.length > 0)

  return (
    <div className="mypage-page">
      <TopBar showSearch={false} />
      <div className="mypage-shell titles-page-body">
        <div className="titles-page-header">
          <button type="button" className="titles-page-back" onClick={() => navigate(-1)} aria-label={tr('common:actions.back')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#201a14" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <h1 className="titles-page-title">{tr('titles.title')}</h1>
        </div>

        {loading ? (
          <div className="mypage-status">{tr('common:actions.loading')}</div>
        ) : titles.categories.length === 0 ? (
          <div className="mypage-status">{tr('titles.loadError')}</div>
        ) : (
          <>
            <div className="titles-hero">
              <div className="titles-hero-icon" style={{ '--titles-hero-icon-accent': heroMeta.color }}>
                <span>{heroMeta.icon}</span>
              </div>
              <div className="titles-hero-body">
                <div className="titles-hero-label">{tr('titles.current')}</div>
                <div className="titles-hero-name">{titles.equippedTitleName || tr('titles.none')}</div>
                <div className="titles-hero-stat">{tr('titles.stat', { total: totalCount, achieved: totalAchieved })}</div>
              </div>
              <button type="button" className="titles-hero-edit-btn" onClick={() => setShowEquipModal(true)}>
                {tr('titles.change')}
              </button>
            </div>

            <div className="titles-page-hint">{tr('titles.hint')}</div>

            <div className="titles-page-categories">
              {titles.categories.map((group) => {
                const meta = metaFor(group.category)
                const achievedCount = group.titles.filter((t) => t.achieved).length
                return (
                  <section key={group.category} className="titles-page-category">
                    <div className="titles-page-category-head">
                      <span className="titles-page-category-icon" style={{ background: meta.color }}>{meta.icon}</span>
                      <span className="titles-page-category-label">{group.categoryLabel}</span>
                      <span className="titles-page-category-fraction">{achievedCount}/{group.titles.length}</span>
                    </div>
                    <div className="titles-card-grid">
                      {group.titles.map((t) => {
                        const isEquipped = titles.equippedTitleCode === t.code

                        if (!t.achieved) {
                          const remaining = Math.max(t.threshold - t.currentValue, 0)
                          return (
                            <div key={t.code} className="titles-card titles-card--locked">
                              <span className="titles-card-lock" aria-hidden="true">🔒</span>
                              <span className="titles-card-name">{t.name}</span>
                              <span className="titles-card-status">{tr('titles.locked')}</span>
                              <span className="titles-card-reveal">
                                {tr('titles.remaining', { category: group.categoryLabel, remaining, unit: t.unit })}
                              </span>
                            </div>
                          )
                        }

                        return (
                          <button
                            key={t.code}
                            type="button"
                            className={`titles-card titles-card--achieved${isEquipped ? ' is-equipped' : ''}`}
                            style={{ '--titles-card-accent': meta.color }}
                            onClick={() => !isEquipped && handleEquip(t.code)}
                            disabled={isEquipped || equipping !== null}
                          >
                            {isEquipped && <span className="titles-card-badge">{tr('titles.badge')}</span>}
                            <span className="titles-card-icon">{meta.icon}</span>
                            <span className="titles-card-name">{t.name}</span>
                            <span className="titles-card-equip-hint">
                              {isEquipped ? tr('titles.applied') : (equipping === t.code ? tr('titles.applying') : tr('titles.tapToApply'))}
                            </span>
                            <span className="titles-card-reveal">
                              {tr('titles.reached', { category: group.categoryLabel, threshold: t.threshold, unit: t.unit })}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          </>
        )}
      </div>

      {showEquipModal && (
        <div className="titles-equip-modal-backdrop" onClick={() => setShowEquipModal(false)}>
          <div className="titles-equip-modal" onClick={(e) => e.stopPropagation()}>
            <div className="titles-equip-modal-head">
              <h2 className="titles-equip-modal-title">{tr('titles.modalTitle')}</h2>
              <button
                type="button"
                className="titles-equip-modal-close"
                onClick={() => setShowEquipModal(false)}
                aria-label={tr('titles.close')}
              >
                ✕
              </button>
            </div>
            <div className="titles-equip-modal-body">
              {achievableGroups.length === 0 ? (
                <div className="mypage-status">{tr('titles.modalEmpty')}</div>
              ) : (
                achievableGroups.map((group) => {
                  const meta = metaFor(group.category)
                  return (
                    <div key={group.category} className="titles-equip-modal-group">
                      <div className="titles-equip-modal-group-label">
                        <span className="titles-page-category-icon" style={{ background: meta.color }}>{meta.icon}</span>
                        {group.categoryLabel}
                      </div>
                      <div className="titles-equip-modal-rows">
                        {group.titles.map((t) => {
                          const isEquipped = titles.equippedTitleCode === t.code
                          return (
                            <button
                              key={t.code}
                              type="button"
                              className={`titles-equip-modal-row${isEquipped ? ' is-equipped' : ''}`}
                              onClick={() => !isEquipped && handleEquipFromModal(t.code)}
                              disabled={isEquipped || equipping !== null}
                            >
                              <span>{t.name}</span>
                              {isEquipped ? (
                                <span className="titles-equip-modal-current">{tr('titles.currentlyApplied')}</span>
                              ) : (
                                equipping === t.code && <span className="titles-equip-modal-current">{tr('titles.applying')}</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
