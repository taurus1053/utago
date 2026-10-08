import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  getMyRole, searchSongsForAdmin, listFeaturedSongs, setSongFeatured,
  listAllSongsForAdmin, setSongGenre,
} from '../api/admin'
import './AdminTranslations.css'

// 관리자 전용 — 홈 화면 "오늘의 추천곡" 카드가 뽑아 보여줄 수 있는 곡을 관리자가 직접
// 고르는 화면. 예전엔 유튜브 영상이 있는 공개/본인 소유 곡 중 아무거나 무작위로 뽑았는데,
// 저작권 리스크를 더 낮추려고 — 관리자가 미리 "추천곡"으로 지정해둔 곡들 중에서만
// 뽑도록 바꿨다(HomeLyricService.getRandomSongOfDay). 이 화면이 그 지정/해제를 한다.
//
// 접근 제어는 다른 관리자 화면과 동일 — GET /api/users/me/role로 ADMIN 여부를 다시
// 확인한다(백엔드 AdminSongController도 매 요청마다 동일하게 확인하므로 이건 UX 가드일 뿐).
//
// 2026-10-08 추가 — 칭호 "장르"(claude/소셜_마이페이지_기획.md 17-8번)를 위해 곡마다 장르를
// 지정하는 기능을 이 화면에 얹었다. 추천곡 지정과는 별개 작업이라, 검색/추천곡 목록과는
// 독립적으로 장르 select를 각 행에 붙였다. 장르 작업은 "뭘 찾을지 모르고 훑는" 일이라
// 검색창만으론 부족해서, 맨 위에 "전체 곡 둘러보기"(비공개 포함, 페이지네이션) 섹션을
// 새로 추가 — "미지정만 보기"를 켜두면 장르 안 매긴 곡들이 할 일 목록처럼 순서대로 나온다.

const LANG_LABEL = { JA: '일본어', KO: '한국어', EN: '영어' }

// 곡 장르 — 백엔드 SongGenre enum과 코드를 맞춰야 한다. 대부분 언어/국적과 무관하게
// 스타일로만 분류하지만, KPOP/JPOP은 그 자체로 통용되는 씬 이름이라 예외로 포함
// (2026-10-08 사용자 요청). AI 학습곡 전용 "AI" 장르도 포함.
const GENRE_OPTIONS = [
  { value: 'KPOP', label: 'K-POP' },
  { value: 'JPOP', label: 'J-POP' },
  { value: 'POP', label: '팝' },
  { value: 'BALLAD', label: '발라드' },
  { value: 'ROCK', label: '록' },
  { value: 'DANCE_EDM', label: '댄스·EDM' },
  { value: 'HIPHOP_RNB', label: '힙합·R&B' },
  { value: 'CITY_POP', label: '시티팝' },
  { value: 'ACOUSTIC_FOLK', label: '어쿠스틱·포크' },
  { value: 'JAZZ_SOUL', label: '재즈·소울' },
  { value: 'TROT', label: '트로트' },
  { value: 'OST', label: 'OST·사운드트랙' },
  { value: 'ANIME', label: '애니메이션' },
  { value: 'VOCALOID', label: '보컬로이드' },
  { value: 'AI', label: 'AI' },
]

// 곡 하나의 장르를 바로 바꿀 수 있는 select — 별도 "저장" 버튼 없이 onChange 즉시 반영.
// 바뀌는 순간 "저장됨"을 잠깐 보여주고, 저장이 실패하면 select를 원래 값으로 되돌린다.
function GenreSelect({ song, onChanged }) {
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [error, setError] = useState(null)

  async function handleChange(e) {
    const value = e.target.value
    const nextGenre = value === '' ? null : value
    setSaving(true)
    setError(null)
    try {
      const updated = await setSongGenre(song.id, nextGenre)
      onChanged(updated)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-tr-row-genre">
      <span className="admin-tr-row-genre-label">장르</span>
      <select
        value={song.genre || ''}
        onChange={handleChange}
        disabled={saving}
        className={song.genre ? '' : 'unset'}
      >
        <option value="">미지정</option>
        {GENRE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <span className={`admin-tr-row-genre-saved${justSaved ? ' show' : ''}`}>저장됨</span>
      {error && <span className="admin-tr-notice-inline admin-tr-notice-inline--error">{error}</span>}
    </div>
  )
}

export default function AdminFeaturedSongs() {
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

  // ---- 전체 곡 둘러보기(장르 지정용) ----
  const [browsePage, setBrowsePage] = useState(0)
  const [onlyUngenred, setOnlyUngenred] = useState(true)
  const [browseData, setBrowseData] = useState(null) // Spring Page 원본
  const [browseLoading, setBrowseLoading] = useState(true)
  const [browseError, setBrowseError] = useState(null)

  function reloadBrowse(page = browsePage, ungenredFilter = onlyUngenred) {
    setBrowseLoading(true)
    setBrowseError(null)
    listAllSongsForAdmin({ onlyUngenred: ungenredFilter, page, size: 20 })
      .then((data) => setBrowseData(data))
      .catch((err) => setBrowseError(err))
      .finally(() => setBrowseLoading(false))
  }

  useEffect(() => {
    if (access !== 'ok') return
    reloadBrowse(0, onlyUngenred)
    setBrowsePage(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access, onlyUngenred])

  function handleBrowsePage(nextPage) {
    setBrowsePage(nextPage)
    reloadBrowse(nextPage, onlyUngenred)
  }

  function handleBrowseGenreChanged(updated) {
    setBrowseData((prev) => {
      if (!prev) return prev
      // "미지정만 보기"가 켜져 있는데 장르를 지정했으면 이 목록에서 바로 사라져야 자연스럽다.
      if (onlyUngenred && updated.genre) {
        return { ...prev, content: prev.content.filter((s) => s.id !== updated.id) }
      }
      return { ...prev, content: prev.content.map((s) => (s.id === updated.id ? updated : s)) }
    })
  }

  // ---- 검색해서 찾기 ----
  const [featured, setFeatured] = useState([])
  const [featuredLoading, setFeaturedLoading] = useState(true)
  const [featuredError, setFeaturedError] = useState(null)

  function reloadFeatured() {
    setFeaturedLoading(true)
    setFeaturedError(null)
    listFeaturedSongs()
      .then((data) => setFeatured(data))
      .catch((err) => setFeaturedError(err))
      .finally(() => setFeaturedLoading(false))
  }

  useEffect(() => {
    if (access !== 'ok') return
    reloadFeatured()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access])

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setSearchError(null)
    try {
      const data = await searchSongsForAdmin(query)
      setResults(data)
    } catch (err) {
      setSearchError(err)
    } finally {
      setSearching(false)
    }
  }

  const [togglingId, setTogglingId] = useState(null)
  const [toggleError, setToggleError] = useState(null)

  async function handleToggle(song, nextFeatured) {
    setTogglingId(song.id)
    setToggleError(null)
    try {
      const updated = await setSongFeatured(song.id, nextFeatured)
      // 검색 결과 목록과 추천곡 목록 둘 다, 화면에 보이는 해당 곡의 featured 상태를 바로 반영.
      setResults((prev) => prev && prev.map((s) => (s.id === song.id ? updated : s)))
      reloadFeatured()
    } catch (err) {
      setToggleError({ songId: song.id, message: err.message })
    } finally {
      setTogglingId(null)
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

  return (
    <div className="admin-tr-page">
      <header className="admin-tr-topbar">
        <button className="admin-tr-back" onClick={() => navigate(-1)} aria-label="뒤로 가기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span className="admin-tr-topbar-title">곡 관리</span>
        <Link to="/admin/songs" className="admin-song-nav-link">AI 학습곡 등록 →</Link>
        <Link to="/admin/translations" className="admin-song-nav-link admin-song-nav-link--plain">번역 캐시 관리 →</Link>
      </header>

      <div className="admin-tr-content">
        <p className="admin-tr-notice">
          여기서 켠 곡들만 홈 화면 "오늘의 추천곡" 카드에 무작위로 노출돼요. 장르는 이 화면
          어디서든 곡마다 바로 지정할 수 있어요 — 지정한 장르는 칭호(마이페이지 → 칭호)의
          "장르" 항목 집계에 쓰여요. 유튜브 영상이 연결된 곡만 추천곡으로 지정할 수 있어요.
        </p>

        <section className="admin-tr-section">
          <div className="admin-tr-section-toolbar">
            <span className="admin-tr-label">전체 곡 둘러보기 (장르 지정용)</span>
            <label className="admin-tr-checkbox-label">
              <input
                type="checkbox"
                checked={onlyUngenred}
                onChange={(e) => setOnlyUngenred(e.target.checked)}
              />
              미지정만 보기
            </label>
          </div>
          <p className="admin-tr-bulk-desc">
            공개/비공개 상관없이 등록된 모든 곡이 최신순으로 나와요. 사용자가 직접 등록한
            비공개 곡도 여기서 같이 장르를 매길 수 있어요.
          </p>

          {browseLoading ? (
            <p className="admin-tr-status" style={{ marginTop: 8 }}>불러오는 중...</p>
          ) : browseError ? (
            <p className="admin-tr-status" style={{ marginTop: 8 }}>목록을 불러오지 못했어요.</p>
          ) : !browseData || browseData.content.length === 0 ? (
            <p className="admin-tr-status" style={{ marginTop: 8 }}>
              {onlyUngenred ? '장르 미지정 곡이 더 없어요 — 전부 지정했어요!' : '등록된 곡이 없어요.'}
            </p>
          ) : (
            <>
              <div className="admin-tr-table" style={{ marginTop: 4 }}>
                {browseData.content.map((song) => (
                  <div className="admin-tr-row" key={song.id}>
                    <div className="admin-tr-row-meta">
                      <span className="admin-tr-badge">{LANG_LABEL[song.sourceLang] ?? song.sourceLang}</span>
                      {song.visibility !== 'PUBLIC' && <span className="admin-tr-badge admin-tr-badge--ai">비공개</span>}
                    </div>
                    <div className="admin-tr-row-original">{song.title} · {song.artist}</div>
                    <GenreSelect song={song} onChanged={handleBrowseGenreChanged} />
                  </div>
                ))}
              </div>
              <div className="admin-tr-pagination" style={{ marginTop: 4 }}>
                <button type="button" disabled={browseData.first} onClick={() => handleBrowsePage(browsePage - 1)}>← 이전</button>
                <span>
                  {browseData.number + 1} / {Math.max(browseData.totalPages, 1)} 페이지
                  {onlyUngenred && ` (미지정 ${browseData.totalElements}곡)`}
                </span>
                <button type="button" disabled={browseData.last} onClick={() => handleBrowsePage(browsePage + 1)}>다음 →</button>
              </div>
            </>
          )}
        </section>

        <section className="admin-tr-section">
          <span className="admin-tr-label">곡 검색해서 추천곡 지정 / 장르 지정</span>
          <form className="admin-tr-filter-row admin-tr-search-form" onSubmit={handleSearch} style={{ marginTop: 8 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목 또는 아티스트로 검색"
            />
            <button type="submit" disabled={searching || !query.trim()}>
              {searching ? '검색 중...' : '검색'}
            </button>
          </form>
          {searchError && <div className="admin-tr-notice-inline admin-tr-notice-inline--error">검색하지 못했어요. {searchError.message}</div>}

          {results !== null && (
            <div className="admin-tr-table" style={{ marginTop: 10 }}>
              {results.length === 0 ? (
                <p className="admin-tr-status">검색 결과가 없어요.</p>
              ) : (
                results.map((song) => (
                  <div className="admin-tr-row" key={song.id}>
                    <div className="admin-tr-row-meta">
                      <span className="admin-tr-badge">{LANG_LABEL[song.sourceLang] ?? song.sourceLang}</span>
                      {song.visibility !== 'PUBLIC' && <span className="admin-tr-badge admin-tr-badge--ai">비공개</span>}
                      {!song.youtubeVideoId && <span className="admin-tr-badge admin-tr-badge--ai">영상 없음</span>}
                    </div>
                    <div className="admin-tr-row-original">{song.title} · {song.artist}</div>
                    <GenreSelect
                      song={song}
                      onChanged={(updated) =>
                        setResults((prev) => prev && prev.map((s) => (s.id === updated.id ? updated : s)))
                      }
                    />
                    {toggleError?.songId === song.id && (
                      <div className="admin-tr-notice-inline admin-tr-notice-inline--error">{toggleError.message}</div>
                    )}
                    <div className="admin-tr-row-actions">
                      {song.featured ? (
                        <button
                          type="button"
                          className="admin-tr-btn-ghost"
                          onClick={() => handleToggle(song, false)}
                          disabled={togglingId === song.id}
                        >
                          {togglingId === song.id ? '처리 중...' : '추천곡 해제'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggle(song, true)}
                          disabled={togglingId === song.id || !song.youtubeVideoId}
                        >
                          {togglingId === song.id ? '처리 중...' : '추천곡으로 지정'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        <section className="admin-tr-section">
          <span className="admin-tr-label">현재 추천곡 ({featured.length}곡)</span>
          {featuredLoading ? (
            <p className="admin-tr-status" style={{ marginTop: 8 }}>불러오는 중...</p>
          ) : featuredError ? (
            <p className="admin-tr-status" style={{ marginTop: 8 }}>목록을 불러오지 못했어요.</p>
          ) : featured.length === 0 ? (
            <p className="admin-tr-status" style={{ marginTop: 8 }}>아직 지정된 추천곡이 없어요. 위에서 검색해서 추가해보세요.</p>
          ) : (
            <div className="admin-tr-table" style={{ marginTop: 10 }}>
              {featured.map((song) => (
                <div className="admin-tr-row" key={song.id}>
                  <div className="admin-tr-row-meta">
                    <span className="admin-tr-badge">{LANG_LABEL[song.sourceLang] ?? song.sourceLang}</span>
                  </div>
                  <div className="admin-tr-row-original">{song.title} · {song.artist}</div>
                  <GenreSelect
                    song={song}
                    onChanged={(updated) =>
                      setFeatured((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
                    }
                  />
                  <div className="admin-tr-row-actions">
                    <button
                      type="button"
                      className="admin-tr-btn-ghost"
                      onClick={() => handleToggle(song, false)}
                      disabled={togglingId === song.id}
                    >
                      {togglingId === song.id ? '처리 중...' : '추천곡 해제'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
