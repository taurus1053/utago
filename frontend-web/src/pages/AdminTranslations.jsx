import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  getMyRole,
  listLineTranslations,
  upsertLineTranslation,
  batchUpsertLineTranslations,
  updateLineTranslation,
  deleteLineTranslation,
} from '../api/admin'
import './AdminTranslations.css'

// 관리자 전용 — 소절 번역 캐시(line_translation_cache) 관리 화면.
// "AI 번역 초안 받기"가 캐시에 없는 줄만 실제로 AI를 호출하는 구조라서(LineTranslationCacheService),
// 여기서 운영진이 미리 넣어둔 번역(source=ADMIN)은 항상 우선 재사용되고 AI가 덮어쓰지 않는다.
//
// 접근 제어는 로그인 여부(RequireAuth, App.jsx)와 별개로 이 화면 자체가 GET /api/users/me/role을
// 불러서 ADMIN이 아니면 홈으로 돌려보낸다 — 백엔드도 매 요청마다 동일하게 확인하므로(403),
// 이건 UX용 가드일 뿐 실제 보안은 서버가 담당.

const LANG_OPTIONS = [
  { value: 'JA', label: '일본어' },
  { value: 'KO', label: '한국어' },
  { value: 'EN', label: '영어' },
]

export default function AdminTranslations() {
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

  // 새 항목 등록 폼.
  const [newLang, setNewLang] = useState('JA')
  const [newOriginal, setNewOriginal] = useState('')
  const [newTranslation, setNewTranslation] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState(null)

  // "여러 줄 한번에 추가" 모드 — 원문 전체/번역 전체를 각각 줄바꿈으로 구분해서 붙여넣으면
  // 빈 줄은 걸러내고 순서대로 짝지어 한 번에 저장한다. 두 쪽 실제 줄 수가 다르면(예: 한쪽에
  // 빈 줄이 더 있거나 줄이 나뉜 방식이 다르면) 밀려서 잘못 매칭될 수 있어서, 저장 전에
  // 줄 수가 같은지 먼저 확인하고 다르면 안내만 하고 막는다.
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkOriginal, setBulkOriginal] = useState('')
  const [bulkTranslation, setBulkTranslation] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkNotice, setBulkNotice] = useState(null)

  function splitNonEmptyLines(text) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }

  const bulkOriginalLines = splitNonEmptyLines(bulkOriginal)
  const bulkTranslationLines = splitNonEmptyLines(bulkTranslation)
  const bulkCountMismatch =
    bulkOriginal.trim() !== '' &&
    bulkTranslation.trim() !== '' &&
    bulkOriginalLines.length !== bulkTranslationLines.length

  async function handleBulkAdd(e) {
    e.preventDefault()
    if (bulkOriginalLines.length === 0 || bulkTranslationLines.length === 0) {
      setBulkNotice({ type: 'error', text: '원문과 번역을 모두 입력해주세요.' })
      return
    }
    if (bulkCountMismatch) {
      setBulkNotice({
        type: 'error',
        text: `줄 수가 서로 달라요 (원문 ${bulkOriginalLines.length}줄 / 번역 ${bulkTranslationLines.length}줄). 빈 줄을 정리하고 같은 순서로 한 줄씩 맞춰서 다시 붙여넣어 주세요.`,
      })
      return
    }
    setBulkSaving(true)
    setBulkNotice(null)
    try {
      const saved = await batchUpsertLineTranslations({
        sourceLang: newLang,
        originalLines: bulkOriginalLines,
        translationLines: bulkTranslationLines,
      })
      setBulkNotice({ type: 'success', text: `${saved.length}줄 저장했어요.` })
      setBulkOriginal('')
      setBulkTranslation('')
      setPage(0)
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setBulkNotice({ type: 'error', text: err.message })
    } finally {
      setBulkSaving(false)
    }
  }

  // 목록 조회 (필터 + 페이지네이션).
  const [filterLang, setFilterLang] = useState('')
  const [queryInput, setQueryInput] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [page, setPage] = useState(0)
  const [pageData, setPageData] = useState(null)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (access !== 'ok') return
    let alive = true
    setListLoading(true)
    setListError(null)
    listLineTranslations({ sourceLang: filterLang || undefined, query: appliedQuery, page, size: 20 })
      .then((data) => {
        if (alive) setPageData(data)
      })
      .catch((err) => {
        if (alive) setListError(err.message)
      })
      .finally(() => {
        if (alive) setListLoading(false)
      })
    return () => {
      alive = false
    }
  }, [access, filterLang, appliedQuery, page, refreshTick])

  function handleSearchSubmit(e) {
    e.preventDefault()
    setPage(0)
    setAppliedQuery(queryInput.trim())
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!newOriginal.trim() || !newTranslation.trim()) {
      setSaveNotice({ type: 'error', text: '원문과 번역을 모두 입력해주세요.' })
      return
    }
    setSaving(true)
    setSaveNotice(null)
    try {
      await upsertLineTranslation({
        sourceLang: newLang,
        originalText: newOriginal,
        translationText: newTranslation,
      })
      setSaveNotice({ type: 'success', text: '저장했어요. (같은 원문이 이미 있었으면 번역만 갱신됐어요)' })
      setNewOriginal('')
      setNewTranslation('')
      setPage(0)
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setSaveNotice({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  // 목록의 각 행 인라인 편집(번역문만).
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [rowError, setRowError] = useState(null)

  function startEdit(row) {
    setEditingId(row.id)
    setEditingText(row.translationText)
    setRowError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingText('')
  }

  async function saveEdit(id) {
    if (!editingText.trim()) return
    setRowError(null)
    try {
      await updateLineTranslation(id, editingText.trim())
      setEditingId(null)
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setRowError(err.message)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('이 번역 캐시 항목을 삭제할까요? (다음에 같은 원문이 들어오면 다시 AI가 번역해요)')) {
      return
    }
    setRowError(null)
    try {
      await deleteLineTranslation(id)
      setRefreshTick((n) => n + 1)
    } catch (err) {
      setRowError(err.message)
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

  const content = pageData?.content ?? []
  const totalPages = pageData?.totalPages ?? 0
  const totalElements = pageData?.totalElements ?? 0

  return (
    <div className="admin-tr-page">
      <header className="admin-tr-topbar">
        <button className="admin-tr-back" onClick={() => navigate(-1)} aria-label="뒤로 가기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span className="admin-tr-topbar-title">번역 캐시 관리</span>
        <Link to="/admin/songs" className="admin-song-nav-link">AI 학습곡 등록 →</Link>
        <Link to="/admin/featured-songs" className="admin-song-nav-link admin-song-nav-link--plain">추천곡 관리 →</Link>
      </header>

      <div className="admin-tr-content">
        <p className="admin-tr-notice">
          여기서 등록/수정한 번역은 항상 &quot;검수됨(ADMIN)&quot;으로 저장되고, 곡 등록 화면의
          &quot;AI 번역 초안 받기&quot;가 같은 원문 줄을 만나면 AI를 다시 돌리지 않고 이 번역을
          그대로 씁니다. AI가 대신 채운 항목(AI)은 여기서 덮어쓰면 ADMIN으로 승격돼요.
        </p>

        <section className="admin-tr-section">
          <div className="admin-tr-section-header">
            <span className="admin-tr-label">
              {bulkMode ? '여러 줄 한번에 추가' : '새 번역 추가 / 갱신'}
            </span>
            <button
              type="button"
              className="admin-tr-mode-toggle"
              onClick={() => setBulkMode((v) => !v)}
            >
              {bulkMode ? '한 줄씩 입력하기' : '여러 줄 한번에 추가'}
            </button>
          </div>

          {bulkMode ? (
            <form className="admin-tr-add-form" onSubmit={handleBulkAdd}>
              <select value={newLang} onChange={(e) => setNewLang(e.target.value)}>
                {LANG_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="admin-tr-bulk-desc">
                원문 전체와 번역 전체를 각각 줄바꿈으로 구분해서 붙여넣으면, 빈 줄은 자동으로
                걸러내고 순서대로 한 줄씩 짝지어 저장해요. 양쪽 줄 수가 같아야 해요.
              </p>
              <textarea
                value={bulkOriginal}
                onChange={(e) => setBulkOriginal(e.target.value)}
                placeholder="원문 전체 (한 줄에 한 소절씩)"
                rows={8}
              />
              <textarea
                value={bulkTranslation}
                onChange={(e) => setBulkTranslation(e.target.value)}
                placeholder="번역 전체 (한 줄에 한 소절씩, 같은 순서로)"
                rows={8}
              />
              <div className="admin-tr-bulk-count">
                원문 {bulkOriginalLines.length}줄 / 번역 {bulkTranslationLines.length}줄
                {bulkCountMismatch && (
                  <span className="admin-tr-bulk-count--warn"> — 줄 수가 달라요</span>
                )}
              </div>
              <button type="submit" disabled={bulkSaving || bulkCountMismatch}>
                {bulkSaving ? '저장 중...' : '저장'}
              </button>
            </form>
          ) : (
            <form className="admin-tr-add-form" onSubmit={handleAdd}>
              <select value={newLang} onChange={(e) => setNewLang(e.target.value)}>
                {LANG_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <textarea
                value={newOriginal}
                onChange={(e) => setNewOriginal(e.target.value)}
                placeholder="원문 한 소절"
                rows={2}
              />
              <textarea
                value={newTranslation}
                onChange={(e) => setNewTranslation(e.target.value)}
                placeholder="번역"
                rows={2}
              />
              <button type="submit" disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </form>
          )}

          {(bulkMode ? bulkNotice : saveNotice) && (
            <div className={`admin-tr-notice-inline admin-tr-notice-inline--${(bulkMode ? bulkNotice : saveNotice).type}`}>
              {(bulkMode ? bulkNotice : saveNotice).text}
            </div>
          )}
        </section>

        <section className="admin-tr-section">
          <div className="admin-tr-filter-row">
            <select value={filterLang} onChange={(e) => { setFilterLang(e.target.value); setPage(0) }}>
              <option value="">전체 언어</option>
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <form className="admin-tr-search-form" onSubmit={handleSearchSubmit}>
              <input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="원문 검색"
              />
              <button type="submit">검색</button>
            </form>
          </div>

          {listLoading && <p className="admin-tr-status">불러오는 중...</p>}
          {listError && <div className="admin-tr-notice-inline admin-tr-notice-inline--error">{listError}</div>}
          {rowError && <div className="admin-tr-notice-inline admin-tr-notice-inline--error">{rowError}</div>}

          {!listLoading && content.length === 0 && (
            <p className="admin-tr-status">등록된 번역이 없어요.</p>
          )}

          {content.length > 0 && (
            <div className="admin-tr-table">
              {content.map((row) => (
                <div className="admin-tr-row" key={row.id}>
                  <div className="admin-tr-row-meta">
                    <span className="admin-tr-badge">{row.sourceLang}</span>
                    <span className={`admin-tr-badge admin-tr-badge--${row.source.toLowerCase()}`}>
                      {row.source === 'ADMIN' ? '검수됨' : 'AI'}
                    </span>
                  </div>
                  <div className="admin-tr-row-original">{row.originalText}</div>
                  {editingId === row.id ? (
                    <div className="admin-tr-row-edit">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={2}
                      />
                      <div className="admin-tr-row-edit-actions">
                        <button type="button" onClick={() => saveEdit(row.id)}>저장</button>
                        <button type="button" className="admin-tr-btn-ghost" onClick={cancelEdit}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className="admin-tr-row-translation" onClick={() => startEdit(row)} title="클릭해서 수정">
                      {row.translationText}
                    </div>
                  )}
                  <div className="admin-tr-row-actions">
                    <button type="button" className="admin-tr-btn-ghost" onClick={() => handleDelete(row.id)}>
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="admin-tr-pagination">
              <button type="button" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
                이전
              </button>
              <span>{page + 1} / {totalPages} (총 {totalElements}개)</span>
              <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                다음
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
