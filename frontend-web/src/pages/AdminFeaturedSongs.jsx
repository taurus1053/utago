import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getMyRole, searchSongsForAdmin, listFeaturedSongs, setSongFeatured } from '../api/admin'
import './AdminTranslations.css'

// 관리자 전용 — 홈 화면 "오늘의 추천곡" 카드가 뽑아 보여줄 수 있는 곡을 관리자가 직접
// 고르는 화면. 예전엔 유튜브 영상이 있는 공개/본인 소유 곡 중 아무거나 무작위로 뽑았는데,
// 저작권 리스크를 더 낮추려고 — 관리자가 미리 "추천곡"으로 지정해둔 곡들 중에서만
// 뽑도록 바꿨다(HomeLyricService.getRandomSongOfDay). 이 화면이 그 지정/해제를 한다.
//
// 접근 제어는 다른 관리자 화면과 동일 — GET /api/users/me/role로 ADMIN 여부를 다시
// 확인한다(백엔드 AdminSongController도 매 요청마다 동일하게 확인하므로 이건 UX 가드일 뿐).

const LANG_LABEL = { JA: '일본어', KO: '한국어', EN: '영어' }

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
        <span className="admin-tr-topbar-title">추천곡 관리</span>
        <Link to="/admin/songs" className="admin-song-nav-link">AI 학습곡 등록 →</Link>
        <Link to="/admin/translations" className="admin-song-nav-link admin-song-nav-link--plain">번역 캐시 관리 →</Link>
      </header>

      <div className="admin-tr-content">
        <p className="admin-tr-notice">
          여기서 켠 곡들만 홈 화면 "오늘의 추천곡" 카드에 무작위로 노출돼요. 가사 원문은 전혀
          보여주지 않고 유튜브 썸네일 + 곡 정보만 보여주지만, 그래도 아무 곡이나 무작위로
          노출하지 않도록 관리자가 직접 고른 곡만 후보에 들어가게 했어요. 유튜브 영상이
          연결된 곡만 지정할 수 있어요(썸네일이 필요해서요).
        </p>

        <section className="admin-tr-section">
          <span className="admin-tr-label">곡 검색해서 추천곡으로 지정</span>
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
