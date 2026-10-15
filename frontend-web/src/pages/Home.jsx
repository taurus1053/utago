import { useCallback, useEffect, useMemo, useState } from 'react'
import { isLoggedIn } from '../api/auth'
import { getMySongs, listSongs } from '../api/songs'
import { getSongOfDay, getLyricReview } from '../api/home'
import { getMyPage } from '../api/users'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar'
import './Home.css'

// 디자인 목업(Main.dc.html)을 기반으로 한 실제 홈 화면.
//
// "전체 곡"(공개 카탈로그, GET /api/songs)과 "내 곡"(내가 등록한 곡, GET /api/songs/my,
// 로그인 필요)은 실제 백엔드에 연결되어 있습니다. 곡은 등록한 본인만 볼 수 있는 PRIVATE이
// 기본값이라, "내 곡"에서만 보이고 "전체 곡"에는 안 뜨는 게 정상입니다(운영진이 저작권
// 문제를 해결해서 공개 카탈로그로 승격한 곡만 "전체 곡"에 노출됩니다).
//
// 그 외 "이어서 학습하기" / "복습하기" / "인기 급상승" 은 진행도·인기순위를 내려주는
// API가 아직 없어서(학습기록 도메인 미구현) 당분간 목업 데이터를 유지합니다. 해당 API가
// 생기면 각 MOCK_* 상수를 API 호출로 교체하세요.
// (앨범 자켓 이미지(CONTINUE_SONG/REVIEW_SONG.cover)만은 디자인 목업에서 쓰던 실제
//  이미지를 public/covers/ 에 그대로 가져와 사용 중입니다 — 가사/진행도는 여전히 가짜.)
//
// 상단바(메뉴·로고·검색·알림·프로필)는 곡 추가/곡 학습 화면과 공유하는 components/TopBar로
// 분리되어 있다 — 여기서는 검색창만 켠 채로 그 컴포넌트를 그대로 쓴다.

const CONTINUE_SONG = {
  title: '踊り子',
  artist: 'Vaundy',
  cover: '/covers/odoriko.webp',
  progressPercent: 35,
  progressCurrent: 12,
  progressTotal: 34,
}
const CONTINUE_LINES = [
  '夜の帳が下りる頃 街の灯りが揺れる',
  '誰にも言えない秘密を抱えて 歩き出す',
  '風が頬をかすめてく その先に何がある',
  '迷いながらも進んでく それが僕の生き方',
  '遠くで鳴る足音が 少しずつ近づいてくる',
]

const REVIEW_SONG = {
  title: 'アイドル',
  artist: 'YOASOBI',
  cover: '/covers/idol.jpg',
  completedCount: 3,
  lastDays: 5,
}
const REVIEW_LINES = [
  '夜道を歩きながら 君のことを思う',
  'この歌がずっと 続けばいいのに',
  'そんな願いも 胸にしまって',
  '明日もまた同じ景色を 歩いていくんだろう',
  '小さな声で歌う メロディーが響く',
]

const POPULAR_SONGS = [
  { title: 'アイドル', artist: 'YOASOBI', color: '#f3e2d8' },
  { title: '봄날', artist: '방탄소년단', color: '#eef1e6' },
  { title: '怪物', artist: 'YOASOBI', color: '#f3e2d8' },
  { title: 'Dynamite', artist: 'BTS', color: '#e7edf3' },
]

const GENRES = [
  { label: 'J-POP', bg: 'linear-gradient(135deg,#f3e2d8,#e9c3ae)', color: '#7a3417' },
  { label: 'K-POP', bg: 'linear-gradient(135deg,#eef1e6,#d3ddc4)', color: '#445236' },
  { label: 'POP', bg: 'linear-gradient(135deg,#e7edf3,#c6d6e6)', color: '#2c4a68' },
  { label: '발라드', labelKey: 'ballad', bg: 'linear-gradient(135deg,#efe6f5,#d9c3ea)', color: '#5c3a75' },
  { label: '초급', labelKey: 'beginner', bg: 'linear-gradient(135deg,#fdeee0,#f6cfa8)', color: '#8a4a10' },
  { label: '고급', labelKey: 'advanced', bg: '#201a14', color: '#ffffff' },
]

const LANG_BADGE = {
  JA: { bg: '#f3e2d8', color: '#b0512f' },
  KO: { bg: '#eef1e6', color: '#5e7150' },
  EN: { bg: '#e7edf3', color: '#3f6488' },
}

// 뱃지에는 내부 코드(JA/KO/EN) 대신 흔히 쓰는 국가 코드 스타일 약어로 표시한다.
const LANG_BADGE_LABEL = { JA: 'JP', KO: 'KR', EN: 'EN' }

// 탭 이름은 화면에서 t(`langFilter.${lang ?? 'all'}`)로 번역해서 보여준다
const LANG_FILTER_OPTIONS = [{ lang: null }, { lang: 'JA' }, { lang: 'KO' }, { lang: 'EN' }]

const SONG_COVER_FALLBACK = '#e7e0d4'

const ROW_PX = 23
const SCROLL_MS = 480

function useLyricTicker(lines, intervalMs) {
  const [base, setBase] = useState(0)
  const [offset, setOffset] = useState(0)
  const [transitionOn, setTransitionOn] = useState(false)

  useEffect(() => {
    const tick = setInterval(() => {
      setTransitionOn(true)
      setOffset(1)
      setTimeout(() => {
        setTransitionOn(false)
        setOffset(0)
        setBase((b) => (b + 1) % lines.length)
      }, SCROLL_MS)
    }, intervalMs)
    return () => clearInterval(tick)
  }, [lines, intervalMs])

  const wrap = (i) => lines[((i % lines.length) + lines.length) % lines.length]

  return {
    row0: wrap(base - 1),
    row1: wrap(base),
    row2: wrap(base + 1),
    row3: wrap(base + 2),
    offsetPx: `-${offset * ROW_PX}px`,
    transitionCss: transitionOn ? 'transform 0.48s cubic-bezier(0.22,0.61,0.36,1)' : 'none',
    colorTransitionCss: transitionOn ? 'color 0.48s cubic-bezier(0.22,0.61,0.36,1)' : 'none',
    row1Color: offset === 0 ? '#ffffff' : 'rgba(255,255,255,0.55)',
    row2Color: offset === 0 ? 'rgba(255,255,255,0.55)' : '#ffffff',
  }
}

// .home-lyric-words가 3열 그리드(Home.css)라서, 3줄 분량인 9개까지 보여준다 — "3줄 확보
// + 9개" 레이아웃. 단어 목록 자체가 항상 3줄 높이를 최소로 확보하므로(.home-lyric-words의
// min-height, Home.css) 9개보다 적어도 카드가 들쭉날쭉해지지 않고, 그 이상은 "+N개 더"로
// 뭉뚱그린다(전부 보고 싶으면 가사 상세 화면에서 볼 수 있다).
const WORD_DISPLAY_LIMIT = 9

// 가사 소절(원문+의역) + 그 소절에 등장하는 단어/뜻 목록을 함께 보여준다.
// "오늘의 가사"/"가사 복습하기" 카드가 공통으로 쓴다.
function LyricLineBody({ line }) {
  const { t } = useTranslation('home')
  const words = line.words ?? []
  const shownWords = words.slice(0, WORD_DISPLAY_LIMIT)
  const moreCount = words.length - shownWords.length
  return (
    <>
      <p className="home-lyric-original">{line.originalText}</p>
      <p className="home-lyric-translation">{line.translationNatural}</p>
      {(line.songTitle || line.artist) && (
        <p className="home-lyric-source">
          {line.songTitle}
          {line.songTitle && line.artist ? ' · ' : ''}
          {line.artist}
        </p>
      )}
      {shownWords.length > 0 && (
        <ul className="home-lyric-words">
          {shownWords.map((w) => (
            <li key={w.wordId} className="home-lyric-word-row">
              <span className="home-lyric-word-lemma">{w.lemma}</span>
              {w.reading && <span className="home-lyric-word-reading">{w.reading}</span>}
              <span className="home-lyric-word-meaning">
                {w.meanings && w.meanings.length > 0 ? w.meanings.join(', ') : t('lyric.meaningPending')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {moreCount > 0 && <p className="home-lyric-words-more">{t('lyric.moreWords', { count: moreCount })}</p>}
    </>
  )
}

function RefreshButton({ onClick, disabled }) {
  const { t } = useTranslation('home')
  return (
    <button
      type="button"
      className="home-word-refresh-btn"
      onClick={onClick}
      disabled={disabled}
      aria-label={t('refresh')}
      title={t('refresh')}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
        <polyline points="21 3 21 9 15 9"></polyline>
      </svg>
    </button>
  )
}

// 홈 화면 "오늘의 추천곡" 카드 — 단어장에 있고 없고 상관없이, 공개 곡 전체에서 무작위로 곡
// 하나를 추천한다. 예전엔 가사 원문 한 소절을 그대로 보여줬는데, 사용자가 직접 고르지 않은
// 임의의 가사 텍스트를 노출하는 건 저작권 리스크가 있어서 — 가사 텍스트는 전혀 내려받지
// 않고, 유튜브 자체 썸네일 + 곡 정보 + 학습 페이지 링크만 보여주는 "곡 추천"으로 바꿨다.
function SongOfDayCard({ loggedIn }) {
  const { t } = useTranslation('home')
  const [song, setSong] = useState(null)
  const [loading, setLoading] = useState(loggedIn)
  const [error, setError] = useState(null)

  const fetchSong = useCallback(() => {
    if (!loggedIn) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getSongOfDay()
      .then((data) => setSong(data))
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
  }, [loggedIn])

  useEffect(() => {
    fetchSong()
  }, [fetchSong])

  const badge = LANG_BADGE[song?.sourceLang]

  return (
    <div className="home-word-card">
      <div className="home-word-card-header">
        <span className="home-word-card-label">{t('songOfDay.label')}</span>
        {loggedIn && <RefreshButton onClick={fetchSong} disabled={loading} />}
      </div>
      {!loggedIn ? (
        <div className="home-word-status">
          {t('songOfDay.loginPrompt')} <Link to="/login">{t('loginLink')}</Link>
        </div>
      ) : loading && !song ? (
        <div className="home-word-status">{t('loading')}</div>
      ) : error && !song ? (
        <div className="home-word-status home-word-status--error">{t('songOfDay.loadError')}</div>
      ) : !song ? (
        <div className="home-word-status">{t('songOfDay.empty')}</div>
      ) : (
        <Link
          to={`/songs/${song.songId}`}
          className={`home-song-of-day${loading ? ' is-refreshing' : ''}`}
        >
          <div
            className="home-song-of-day-cover"
            style={{
              backgroundImage: song.youtubeVideoId
                ? `url(https://i.ytimg.com/vi/${song.youtubeVideoId}/mqdefault.jpg)`
                : undefined,
            }}
          />
          <div className="home-song-of-day-meta">
            <div className="home-song-of-day-info">
              <span className="home-song-of-day-title">{song.title}</span>
              <span className="home-song-of-day-artist">{song.artist}</span>
            </div>
            <div className="home-song-of-day-foot">
              {badge && (
                <span className="home-song-badge" style={{ background: badge.bg, color: badge.color }}>
                  {LANG_BADGE_LABEL[song.sourceLang] ?? song.sourceLang}
                </span>
              )}
              <span className="home-song-of-day-cta">{t('songOfDay.cta')}</span>
            </div>
          </div>
        </Link>
      )}
    </div>
  )
}

// 홈 화면 "가사 복습하기" 카드 — 내 단어장(즐겨찾기 포함 전체)에 담긴 단어가 실제로 등장하는
// 소절 중 무작위 하나 + 그 소절의 단어/뜻 목록. 비로그인이거나 해당하는 가사가 없으면
// 안내 문구와 함께 단어장으로 가는 링크를 보여준다.
function LyricReviewCard({ loggedIn }) {
  const { t } = useTranslation('home')
  const [line, setLine] = useState(null)
  const [loading, setLoading] = useState(loggedIn)
  const [error, setError] = useState(null)

  const fetchLine = useCallback(() => {
    if (!loggedIn) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getLyricReview()
      .then((data) => setLine(data))
      .catch((err) => setError(err))
      .finally(() => setLoading(false))
  }, [loggedIn])

  useEffect(() => {
    fetchLine()
  }, [fetchLine])

  return (
    <div className="home-word-card">
      <div className="home-word-card-header">
        <span className="home-word-card-label">{t('lyricReview.label')}</span>
        {loggedIn && <RefreshButton onClick={fetchLine} disabled={loading} />}
      </div>
      {!loggedIn ? (
        <div className="home-word-status">
          {t('lyricReview.loginPrompt')} <Link to="/login">{t('loginLink')}</Link>
        </div>
      ) : loading && !line ? (
        <div className="home-word-status">{t('loading')}</div>
      ) : error && !line ? (
        <div className="home-word-status home-word-status--error">{t('lyricReview.loadError')}</div>
      ) : !line ? (
        <div className="home-word-status">
          {t('lyricReview.empty')} <Link to="/wordbook">{t('lyricReview.wordbookLink')}</Link>
        </div>
      ) : (
        <div className={loading ? 'home-word-card-body is-refreshing' : 'home-word-card-body'}>
          <LyricLineBody line={line} />
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const { t } = useTranslation('home')
  const hasReviewSong = true

  const continueTicker = useLyricTicker(CONTINUE_LINES, 2600)
  const reviewTicker = useLyricTicker(REVIEW_LINES, 3000)

  // "전체 곡" 섹션: 실제 GET /api/songs 연결.
  const [langFilterIndex, setLangFilterIndex] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [songs, setSongs] = useState([])
  const [songsTotal, setSongsTotal] = useState(0)
  const [songsLoading, setSongsLoading] = useState(true)
  const [songsError, setSongsError] = useState(null)

  // 모국어가 KO인 사용자에게 "한국어" 탭을 보여줄 필요가 없다(배우는 입장에서 모국어 노래는
  // 의미가 없음, 2026-10-08 사용자 피드백) — "전체" 탭도 백엔드가 모국어 곡은 자동으로
  // 빼고 내려주므로(SongService.listSongs), 탭 자체를 안 보여줘서 "눌러도 결과가 없는"
  // 혼란을 막는다. 비로그인 사용자는 모국어를 모르니 그대로 4개 탭 전부 보여준다.
  const [nativeLang, setNativeLang] = useState(null)
  useEffect(() => {
    if (!isLoggedIn()) return
    getMyPage().then((data) => setNativeLang(data?.nativeLang ?? null)).catch(() => {})
  }, [])
  const langFilterOptions = useMemo(
    () => LANG_FILTER_OPTIONS.filter((opt) => opt.lang === null || opt.lang !== nativeLang),
    [nativeLang],
  )
  useEffect(() => {
    if (langFilterIndex >= langFilterOptions.length) setLangFilterIndex(0)
  }, [langFilterOptions, langFilterIndex])

  // 검색어 입력은 400ms 디바운스 후 실제 쿼리에 반영.
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    setSongsLoading(true)
    setSongsError(null)
    const lang = langFilterOptions[langFilterIndex]?.lang ?? null
    listSongs({ query: searchQuery, lang, page: 0, size: 24 })
      .then((data) => {
        if (cancelled) return
        setSongs(data?.content ?? [])
        setSongsTotal(data?.totalElements ?? (data?.content?.length ?? 0))
      })
      .catch((err) => {
        if (cancelled) return
        setSongs([])
        setSongsTotal(0)
        setSongsError(err)
      })
      .finally(() => {
        if (!cancelled) setSongsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [langFilterOptions, langFilterIndex, searchQuery])

  // "내 곡" 섹션: 실제 GET /api/songs/my 연결 (로그인 필요).
  const loggedIn = isLoggedIn()
  const [mySongs, setMySongs] = useState([])
  const [mySongsLoading, setMySongsLoading] = useState(loggedIn)
  const [mySongsError, setMySongsError] = useState(null)

  useEffect(() => {
    if (!loggedIn) {
      setMySongsLoading(false)
      return
    }
    let cancelled = false
    setMySongsLoading(true)
    setMySongsError(null)
    getMySongs({ page: 0, size: 8 })
      .then((data) => {
        if (cancelled) return
        setMySongs(data?.content ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setMySongs([])
        setMySongsError(err)
      })
      .finally(() => {
        if (!cancelled) setMySongsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loggedIn])

  return (
    <div className="home-page">
      <TopBar showSearch searchValue={searchInput} onSearchChange={setSearchInput} />

      {/* 메인 콘텐츠 */}
      <div className="home-content">

        {/* 이어서 학습하기 · 복습하기 */}
        <div className="home-hero-row">
          <a href="#continue" className="home-hero-card home-hero-card--continue">
            <img className="home-hero-bg" src={CONTINUE_SONG.cover} alt="" aria-hidden="true" />
            <div className="home-hero-overlay" />
            <div className="home-hero-top">
              <img className="home-hero-cover" src={CONTINUE_SONG.cover} alt={t('hero.albumAlt', { title: CONTINUE_SONG.title })} />
              <div className="home-hero-info">
                <div className="home-hero-eyebrow">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  <span>{t('hero.continue')}</span>
                </div>
                <div className="home-hero-title">{CONTINUE_SONG.title}</div>
                <div className="home-hero-artist">{CONTINUE_SONG.artist}</div>
                <div className="home-hero-progress-row">
                  <div className="home-hero-progress-track">
                    <div className="home-hero-progress-fill" style={{ width: `${CONTINUE_SONG.progressPercent}%` }} />
                  </div>
                  <span className="home-hero-progress-label">{t('hero.progressLines', { current: CONTINUE_SONG.progressCurrent, total: CONTINUE_SONG.progressTotal })}</span>
                </div>
              </div>
            </div>

            <div className="home-hero-ticker">
              <div className="home-hero-ticker-highlight" style={{ background: 'rgba(255,157,122,0.7)' }} />
              <div className="home-hero-ticker-rows" style={{ transform: `translateY(${continueTicker.offsetPx})`, transition: continueTicker.transitionCss }}>
                <div className="home-hero-ticker-row"><span style={{ color: 'rgba(255,255,255,0.55)', transition: continueTicker.colorTransitionCss }}>{continueTicker.row0}</span></div>
                <div className="home-hero-ticker-row"><span style={{ color: continueTicker.row1Color, fontWeight: 700, transition: continueTicker.colorTransitionCss }}>{continueTicker.row1}</span></div>
                <div className="home-hero-ticker-row"><span style={{ color: continueTicker.row2Color, fontWeight: 700, transition: continueTicker.colorTransitionCss }}>{continueTicker.row2}</span></div>
                <div className="home-hero-ticker-row"><span style={{ color: 'rgba(255,255,255,0.55)', transition: continueTicker.colorTransitionCss }}>{continueTicker.row3}</span></div>
              </div>
            </div>
          </a>

          <div className="home-hero-card-slot">
            {hasReviewSong ? (
              <a href="#review" className="home-hero-card home-hero-card--review">
                <img className="home-hero-bg" src={REVIEW_SONG.cover} alt="" aria-hidden="true" />
                <div className="home-hero-overlay" style={{ background: 'rgba(10,14,28,0.4)' }} />
                <div className="home-hero-top">
                  <img className="home-hero-cover" src={REVIEW_SONG.cover} alt={t('hero.albumAlt', { title: REVIEW_SONG.title })} />
                  <div className="home-hero-info">
                    <div className="home-hero-eyebrow">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
                        <polyline points="21 3 21 9 15 9"></polyline>
                      </svg>
                      <span>{t('hero.review')}</span>
                    </div>
                    <div className="home-hero-title">{REVIEW_SONG.title}</div>
                    <div className="home-hero-artist">{REVIEW_SONG.artist}</div>
                    <div className="home-hero-progress-row">
                      <span className="home-hero-pill">{t('hero.completedCount', { count: REVIEW_SONG.completedCount })}</span>
                      <span className="home-hero-progress-label">{t('hero.daysAgo', { count: REVIEW_SONG.lastDays })}</span>
                    </div>
                  </div>
                </div>

                <div className="home-hero-ticker">
                  <div className="home-hero-ticker-highlight" style={{ background: 'rgba(111,195,255,0.7)' }} />
                  <div className="home-hero-ticker-rows" style={{ transform: `translateY(${reviewTicker.offsetPx})`, transition: reviewTicker.transitionCss }}>
                    <div className="home-hero-ticker-row"><span style={{ color: 'rgba(255,255,255,0.55)', transition: reviewTicker.colorTransitionCss }}>{reviewTicker.row0}</span></div>
                    <div className="home-hero-ticker-row"><span style={{ color: reviewTicker.row1Color, fontWeight: 700, transition: reviewTicker.colorTransitionCss }}>{reviewTicker.row1}</span></div>
                    <div className="home-hero-ticker-row"><span style={{ color: reviewTicker.row2Color, fontWeight: 700, transition: reviewTicker.colorTransitionCss }}>{reviewTicker.row2}</span></div>
                    <div className="home-hero-ticker-row"><span style={{ color: 'rgba(255,255,255,0.55)', transition: reviewTicker.colorTransitionCss }}>{reviewTicker.row3}</span></div>
                  </div>
                </div>
              </a>
            ) : (
              <div className="home-hero-empty">
                <div className="home-hero-empty-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a89c86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
                    <polyline points="21 3 21 9 15 9"></polyline>
                  </svg>
                </div>
                <div className="home-hero-empty-text">
                  <span className="home-hero-empty-title">{t('hero.emptyTitle')}</span>
                  <span className="home-hero-empty-sub">{t('hero.emptySub1')}<br />{t('hero.emptySub2')}</span>
                </div>
                <a href="#browse" className="home-hero-empty-btn">{t('hero.browse')}</a>
              </div>
            )}
          </div>
        </div>

        {/* 언어 필터 */}
        <div className="home-lang-filters">
          {langFilterOptions.map((opt, i) => (
            <button
              key={opt.lang ?? 'all'}
              onClick={() => setLangFilterIndex(i)}
              className={`home-lang-filter${i === langFilterIndex ? ' home-lang-filter--active' : ''}`}
            >
              {t(`langFilter.${opt.lang ?? 'all'}`)}
            </button>
          ))}
        </div>

        {/* 오늘의 추천곡 · 가사 복습하기 */}
        <div className="home-word-row">
          <SongOfDayCard loggedIn={loggedIn} />
          <LyricReviewCard loggedIn={loggedIn} />
        </div>

        {/* 인기 급상승 */}
        <section className="home-section">
          <h2 className="home-section-title">{t('popular.title')}</h2>
          <div className="home-popular-grid">
            {POPULAR_SONGS.map((song, i) => (
              <div key={song.title} className="home-popular-card">
                <span className="home-popular-rank">{i + 1}</span>
                <div className="home-popular-cover" style={{ background: song.color }} />
                <div className="home-popular-meta">
                  <div className="home-popular-title">{song.title}</div>
                  <div className="home-popular-artist">{song.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 장르·난이도로 둘러보기 */}
        <section className="home-section">
          <h2 className="home-section-title">{t('genre.title')}</h2>
          <div className="home-genre-grid">
            {GENRES.map((g) => (
              <div key={g.label} className="home-genre-chip" style={{ background: g.bg, color: g.color }}>
                {g.labelKey ? t(`genre.${g.labelKey}`) : g.label}
              </div>
            ))}
          </div>
        </section>

        {/* 내 곡 - 실제 GET /api/songs/my 연결. 등록한 곡은 본인에게만 보인다(PRIVATE). */}
        <section className="home-section">
          <div className="home-section-header">
            <h2 className="home-section-title">{t('mySongs.title')}</h2>
            <div className="home-section-header-right">
              <Link to="/songs/new" className="home-section-add-song">{t('mySongs.add')}</Link>
            </div>
          </div>

          {!loggedIn ? (
            <div className="home-song-empty">
              {t('mySongs.loginPrompt')}{' '}
              <Link to="/login">{t('loginLink')}</Link>
            </div>
          ) : mySongsLoading ? (
            <div className="home-song-grid">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="home-song-card home-song-card--skeleton">
                  <div className="home-song-cover" style={{ background: SONG_COVER_FALLBACK }} />
                  <div className="home-song-meta">
                    <span className="home-song-title">{t('loading')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : mySongsError ? (
            <div className="home-song-error">{t('mySongs.loadError')}</div>
          ) : mySongs.length === 0 ? (
            <div className="home-song-empty">
              {t('mySongs.empty')}
            </div>
          ) : (
            <div className="home-song-grid">
              {mySongs.map((song) => {
                const lang = song.sourceLang ?? song.lang
                const badge = LANG_BADGE[lang]
                return (
                  <Link key={song.id ?? song.title} to={`/songs/${song.id}`} className="home-song-card">
                    <div className="home-song-cover" style={{ background: badge?.bg ?? SONG_COVER_FALLBACK }} />
                    <div className="home-song-meta">
                      <span className="home-song-title">{song.title}</span>
                      <span className="home-song-artist">{song.artist}</span>
                    </div>
                    {badge && (
                      <span className="home-song-badge" style={{ background: badge.bg, color: badge.color }}>
                        {LANG_BADGE_LABEL[lang] ?? lang}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* 전체 곡 - 실제 GET /api/songs 연결 */}
        <section className="home-section">
          <div className="home-section-header">
            <h2 className="home-section-title">{t('allSongs.title')}</h2>
            <div className="home-section-header-right">
              {!songsLoading && !songsError && (
                <span className="home-section-count">{t('allSongs.count', { count: songsTotal })}</span>
              )}
              <Link to="/songs/new" className="home-section-add-song">{t('mySongs.add')}</Link>
            </div>
          </div>

          {songsLoading ? (
            <div className="home-song-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="home-song-card home-song-card--skeleton">
                  <div className="home-song-cover" style={{ background: SONG_COVER_FALLBACK }} />
                  <div className="home-song-meta">
                    <span className="home-song-title">{t('loading')}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : songsError ? (
            <div className="home-song-error">{t('allSongs.loadError')}</div>
          ) : songs.length === 0 ? (
            <div className="home-song-empty">{t('allSongs.empty')}</div>
          ) : (
            <div className="home-song-grid">
              {songs.map((song) => {
                const lang = song.sourceLang ?? song.lang
                const badge = LANG_BADGE[lang]
                return (
                  <Link key={song.id ?? song.title} to={`/songs/${song.id}`} className="home-song-card">
                    <div className="home-song-cover" style={{ background: badge?.bg ?? SONG_COVER_FALLBACK }} />
                    <div className="home-song-meta">
                      <span className="home-song-title">{song.title}</span>
                      <span className="home-song-artist">{song.artist}</span>
                    </div>
                    {badge && (
                      <span className="home-song-badge" style={{ background: badge.bg, color: badge.color }}>
                        {LANG_BADGE_LABEL[lang] ?? lang}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </section>

      </div>
      <footer className="home-footer">
        <Link to="/credits">{t('footer.credits')}</Link>
      </footer>
    </div>
  )
}
