import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getSong } from '../api/songs'
import TopBar from '../components/TopBar'
import useYoutubeApiReady from '../hooks/useYoutubeApiReady'
import './SongLearn.css'

const LANG_LABEL = { JA: '일본어', KO: '한국어', EN: '영어' }

// 소절 원문을 단어 단위(line.words, 서버에서 형태소 분석으로 만들어줌)로 쪼개서
// 한자 위에는 후리가나(ruby)를, 단어를 탭하면 뜻 팝업을 보여줄 수 있게 조각낸다.
// words가 없는 곡(일본어가 아니거나 아직 분석 전)은 그냥 원문 텍스트 그대로 보여준다.
// 후리가나가 있는 단어와 없는 단어가 소절마다 섞여 있으면, 그 소절에 ruby(후리가나) 태그가
// 하나라도 있는지 여부에 따라 그 줄의 높이가 들쭉날쭉해진다(브라우저가 rt 높이만큼 줄 높이를
// 늘리기 때문). 그래서 후리가나가 없는 단어도 항상 <ruby>로 감싸되, 안 보이는(투명) 빈 rt를
// 넣어서 — 실제 발음이 있든 없든 모든 소절이 항상 같은 높이를 갖도록 한다.
function rubyOrPlain(surface, furigana) {
  return (
    <ruby>
      {surface}
      <rt className={furigana ? undefined : 'song-learn-rt-empty'}>{furigana || ' '}</rt>
    </ruby>
  )
}

function renderOriginalWithWords(line, activeWordKey, onWordClick) {
  const text = line.originalText
  const words = line.words ?? []
  if (words.length === 0) {
    return text
  }

  const nodes = []
  let cursor = 0
  words.forEach((w, i) => {
    if (w.charOffsetStart > cursor) {
      nodes.push(
        <span key={`plain-${i}`}>{rubyOrPlain(text.slice(cursor, w.charOffsetStart), null)}</span>
      )
    }
    const surface = text.slice(w.charOffsetStart, w.charOffsetEnd)
    const wordKey = `${line.id}-${i}`
    const isActive = activeWordKey === wordKey
    nodes.push(
      <span
        key={wordKey}
        className={`song-learn-word${isActive ? ' song-learn-word--active' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onWordClick(wordKey)
        }}
      >
        {rubyOrPlain(surface, w.furigana)}
        {isActive && (
          <span className="song-learn-word-popup">
            {w.meanings && w.meanings.length > 0 ? w.meanings.join(', ') : '뜻 준비 중'}
          </span>
        )}
      </span>
    )
    cursor = w.charOffsetEnd
  })
  if (cursor < text.length) {
    nodes.push(<span key="plain-end">{rubyOrPlain(text.slice(cursor), null)}</span>)
  }
  return nodes
}

// 한 소절에서 실제로 쓰인 단어들을(surface 기준 중복 제거) [표시 단어(+발음), 뜻] 목록으로
// 만든다. line.words에 이미 들어있는 정보(charOffset/furigana/meanings)만 재사용하므로
// 별도 API 호출이 필요 없다.
// 형태소 분석이 잘못 쪼개서 나오는 조각(활용 어미 축약형 등) — 사전 단어가 아니라서
// 뜻이 있어도 목록에서 제외한다. 완벽한 목록은 아니고, 실제로 보이는 오탐을 하나씩 추가하는 식.
const WORD_LIST_BLOCKLIST = new Set(['てる', 'ちゃう', 'じゃう', 'とく', 'どく', 'なきゃ', 'ちゃった'])

// furigana(w.furigana)는 서버가 "실제 소절에 나온 표면형"의 발음을 준다(예: 悪くない의
// 悪く -> わるく). 단어 목록은 기본형(悪い)으로 바꿔서 보여주므로, 발음도 기본형 발음(わるい)
// 으로 맞춰준다. 일본어 활용은 어간(공통 부분)은 그대로 두고 어미(꼬리)만 정해진 히라가나로
// 바뀌는 규칙이라(요미가나도 그 꼬리 그대로 발음됨), surface/lemma의 공통 어간 길이를 구해서
// 발음 문자열에서도 그만큼만 남기고, 나머지 꼬리를 lemma의 꼬리 글자로 바꿔치기하면 된다.
// (예: surface=悪く, lemma=悪い, reading=わるく -> 공통 어간 1글자(悪) -> "わる" + "い" = "わるい")
function deriveBaseFormReading(surface, lemma, reading) {
  if (!reading) return ''
  if (surface === lemma) return reading
  let commonLen = 0
  const maxCommon = Math.min(surface.length, lemma.length)
  while (commonLen < maxCommon && surface[commonLen] === lemma[commonLen]) commonLen++
  const surfaceTail = surface.slice(commonLen)
  const lemmaTail = lemma.slice(commonLen)
  // 발음 문자열이 표면형 꼬리 길이만큼도 안 되면 안전하게 계산할 수 없어서 원래 발음을 그대로 쓴다.
  if (surfaceTail.length === 0 || reading.length < surfaceTail.length) return reading
  const readingStem = reading.slice(0, reading.length - surfaceTail.length)
  return readingStem + lemmaTail
}

// 한 소절에서 실제로 쓰인 단어들을(사전형 기준 중복 제거) [표시 단어(+발음), 뜻] 목록으로
// 만든다. line.words에 이미 들어있는 정보(charOffset/lemma/furigana/meanings)만 재사용하므로
// 별도 API 호출이 필요 없다. 뜻을 아직 못 찾은 단어나, 형태소 분석이 잘못 쪼갠 조각은 억지로
// 채워서 보여주지 않고 그냥 목록에서 뺀다.
function buildWordList(line) {
  const text = line.originalText
  const words = line.words ?? []
  const seen = new Set()
  const list = []
  words.forEach((w, i) => {
    const surface = text.slice(w.charOffsetStart, w.charOffsetEnd)
    if (!surface.trim()) return
    // 영어 가사 조각(Stay 등)은 일본어 학습용 단어 목록에 필요 없다.
    if (/^[A-Za-z]+$/.test(surface)) return
    // 활용 어미 조각(했다/했어 등에서 분리된 し·き·ん 같은 히라가나 한 글자)은 그 자체로는
    // 단어가 아니라서 단어 목록에서 제외한다. 여러 글자짜리 히라가나(あぁ 같은 감탄사 등)는 남긴다.
    if (surface.length === 1 && /^[ぁ-ゖー]$/.test(surface)) return
    if (WORD_LIST_BLOCKLIST.has(surface) || (w.lemma && WORD_LIST_BLOCKLIST.has(w.lemma.trim()))) return
    // 뜻을 아직 못 찾은 단어는 "뜻 준비 중" 같은 걸로 억지로 채우지 않고 그냥 뺀다 —
    // 형태소 분석이 통째로 잘못 쪼갠 조각(뜻이 없는 긴 히라가나 덩어리 등)도 이걸로 같이 걸러진다.
    if (!w.meanings || w.meanings.length === 0) return
    // 목록에는 활용된 표면형(上手く) 대신 사전형/기본형(上手い, w.lemma)을 보여준다 — 문장
    // 안의 후리가나(ruby)는 실제 표면형 그대로 두고(renderOriginalWithWords), 여기 단어
    // 목록만 사전 찾기 편하게 기본형으로 통일한다. lemma가 없으면 표면형을 그대로 쓴다.
    const displaySurface = w.lemma && w.lemma.trim() ? w.lemma.trim() : surface
    if (seen.has(displaySurface)) return
    seen.add(displaySurface)
    list.push({
      key: `${line.id}-wl-${i}`,
      surface: displaySurface,
      reading: deriveBaseFormReading(surface, displaySurface, w.furigana),
      meaning: w.meanings.join(', '),
    })
  })
  return list
}

// ms를 mm:ss로.
function formatTime(ms) {
  if (!ms || ms < 0) return '0:00'
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// 곡 학습 화면 — 우타고의 핵심 차별화 포인트:
// 1) 소절별 원문(후리가나·단어 탭 포함) + 발음 표기(로그인 사용자 모국어 기준) + 의역 +
//    그 소절에 쓰인 단어 목록을, 한 소절씩 집중해서 보여주는 것("한 줄씩 보기" 기본 모드).
//    전체 가사를 한 번에 훑어보고 싶으면 "전체 가사 보기"로 펼칠 수 있다.
// 2) 그 곡에서 실제로 쓰인 문법 포인트를 짚어주는 것
// 진행도/복습 기록, 오디오 재생 동기화 등은 아직 백엔드에 없어서 다루지 않는다 — "한 줄씩
// 보기"는 재생과 무관하게 소절 사이를 직접 넘기는(◀/▶) 탐색형 모드다.
export default function SongLearn() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [song, setSong] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeGrammarLineId, setActiveGrammarLineId] = useState(null)
  const [activeWordKey, setActiveWordKey] = useState(null)
  const [activeLineIndex, setActiveLineIndex] = useState(0)
  const [expandedAll, setExpandedAll] = useState(false)
  const [autoSync, setAutoSync] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [durationMs, setDurationMs] = useState(0)
  const [currentMs, setCurrentMs] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekPreviewMs, setSeekPreviewMs] = useState(0)

  const apiReady = useYoutubeApiReady()
  const playerRef = useRef(null)

  function toggleWord(key) {
    setActiveWordKey((prev) => (prev === key ? null : key))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setActiveLineIndex(0)
    setExpandedAll(false)
    setAutoSync(false)
    setIsPlaying(false)
    setDurationMs(0)
    setCurrentMs(0)
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

  // 곡(영상)이 바뀌면 이전 플레이어를 정리하고, 새 유튜브 IFrame Player를 만든다.
  useEffect(() => {
    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy()
      }
      playerRef.current = null
    }
  }, [id])

  useEffect(() => {
    if (!apiReady || !song?.youtubeVideoId || playerRef.current) return
    playerRef.current = new window.YT.Player('song-learn-yt-player', {
      videoId: song.youtubeVideoId,
      playerVars: { rel: 0, playsinline: 1, origin: window.location.origin },
      events: {
        onReady: (e) => {
          setDurationMs(e.target.getDuration() * 1000)
        },
        onStateChange: (e) => {
          setIsPlaying(e.data === window.YT.PlayerState.PLAYING)
          if (e.data === window.YT.PlayerState.PLAYING) {
            setDurationMs(e.target.getDuration() * 1000)
          }
        },
      },
    })
  }, [apiReady, song])

  // 재생 위치를 주기적으로 읽어서 (1) 커스텀 플레이어 바(재생 막대)를 갱신하고,
  // (2) 자동 싱크가 켜져 있으면 그 위치가 속한 소절로 "한 줄씩 보기" 포커스를 옮긴다.
  // 사용자가 재생 막대를 드래그하는 중(isSeeking)에는 값을 덮어쓰지 않는다.
  useEffect(() => {
    const interval = setInterval(() => {
      const player = playerRef.current
      if (!player || typeof player.getCurrentTime !== 'function') return
      const nowMs = player.getCurrentTime() * 1000
      if (!isSeeking) {
        setCurrentMs(nowMs)
      }
      if (autoSync) {
        const idx = lines.findIndex((l) => nowMs >= l.startMs && nowMs < l.endMs)
        if (idx !== -1 && idx !== activeLineIndex) {
          setActiveLineIndex(idx)
          setExpandedAll(false)
        }
      }
    }, 250)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync, song, activeLineIndex, isSeeking])

  function handlePlayPause() {
    const player = playerRef.current
    if (!player) return
    if (isPlaying) player.pauseVideo()
    else player.playVideo()
  }

  function commitSeek(newMs) {
    const player = playerRef.current
    if (player && typeof player.seekTo === 'function') {
      player.seekTo(newMs / 1000, true)
    }
    setCurrentMs(newMs)
    setIsSeeking(false)
  }

  const thumbnail = song?.youtubeVideoId
    ? `https://img.youtube.com/vi/${song.youtubeVideoId}/hqdefault.jpg`
    : null

  const lines = song?.lines ?? []
  const clampedIndex = Math.min(activeLineIndex, Math.max(lines.length - 1, 0))
  const activeLine = lines[clampedIndex] ?? null
  const activeWordList = activeLine ? buildWordList(activeLine) : []

  const displayMs = isSeeking ? seekPreviewMs : currentMs

  function focusLine(idx) {
    setActiveLineIndex(idx)
    setExpandedAll(false)
    setActiveWordKey(null)
  }

  return (
    <div className="song-learn-page">
      <TopBar showSearch={false} />
      <div className="app-subbar">
        <button className="app-subbar-back" onClick={() => navigate(-1)} aria-label="뒤로 가기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span className="app-subbar-title">곡 학습</span>
      </div>

      {loading ? (
        <div className="song-learn-status">불러오는 중...</div>
      ) : error ? (
        <div className="song-learn-status song-learn-status--error">
          곡을 불러오지 못했어요. 존재하지 않거나 아직 공개되지 않은 곡일 수 있어요.
        </div>
      ) : !song ? null : (
        <div className="song-learn-content">
        <div className="song-learn-layout">
        <div className="song-learn-left">
          <section className="song-learn-hero">
            {song.youtubeVideoId ? (
              <div
                className="song-learn-video"
                style={thumbnail ? { backgroundImage: `url(${thumbnail})` } : undefined}
              >
                <div id="song-learn-yt-player" />
              </div>
            ) : (
              thumbnail && (
                <img className="song-learn-hero-fallback" src={thumbnail} alt={`${song.title} 커버`} />
              )
            )}

            <div className="song-learn-hero-info">
              {song.sourceLang && (
                <span className="song-learn-lang-badge">{LANG_LABEL[song.sourceLang] ?? song.sourceLang}</span>
              )}
              <h1 className="song-learn-title">{song.title}</h1>
              <span className="song-learn-artist">{song.artist}</span>
            </div>

            {song.youtubeVideoId && (
              <div className="song-learn-player-bar">
                <button
                  type="button"
                  className="song-learn-player-play"
                  onClick={handlePlayPause}
                  aria-label={isPlaying ? '일시정지' : '재생'}
                >
                  {isPlaying ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="5" y="4" width="5" height="16" rx="1"></rect>
                      <rect x="14" y="4" width="5" height="16" rx="1"></rect>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 4l14 8-14 8V4z"></path>
                    </svg>
                  )}
                </button>
                <span className="song-learn-player-time">{formatTime(displayMs)}</span>
                <input
                  type="range"
                  className="song-learn-player-seek"
                  min={0}
                  max={durationMs || 0}
                  step={100}
                  value={isSeeking ? seekPreviewMs : Math.min(currentMs, durationMs || 0)}
                  onChange={(e) => {
                    setIsSeeking(true)
                    setSeekPreviewMs(Number(e.target.value))
                  }}
                  onMouseUp={(e) => commitSeek(Number(e.target.value))}
                  onTouchEnd={(e) => commitSeek(Number(e.target.value))}
                  aria-label="재생 위치"
                />
                <span className="song-learn-player-time">{formatTime(durationMs)}</span>
              </div>
            )}
          </section>
        </div>

        <div className="song-learn-right">
          {song.grammarPoints?.length > 0 && (
            <section className="song-learn-section">
              <h2 className="song-learn-section-title">이 곡의 문법 포인트</h2>
              <div className="song-learn-grammar-list">
                {song.grammarPoints.map((gp) => (
                  <div
                    key={gp.id}
                    className={`song-learn-grammar-card${gp.exampleLineId === activeGrammarLineId ? ' song-learn-grammar-card--active' : ''}`}
                    onMouseEnter={() => setActiveGrammarLineId(gp.exampleLineId)}
                    onMouseLeave={() => setActiveGrammarLineId(null)}
                  >
                    <span className="song-learn-grammar-pattern">{gp.pattern}</span>
                    <p className="song-learn-grammar-explanation">{gp.explanation}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="song-learn-section">
            <div className="song-learn-section-header">
              <h2 className="song-learn-section-title">가사</h2>
              <div className="song-learn-section-actions">
                {song.youtubeVideoId && (
                  <button
                    type="button"
                    className={`song-learn-autosync-btn${autoSync ? ' song-learn-autosync-btn--on' : ''}`}
                    onClick={() => setAutoSync((v) => !v)}
                  >
                    🎵 자동 싱크 {autoSync ? 'ON' : 'OFF'}
                  </button>
                )}
                {song.youtubeVideoId && (
                  <Link to={`/songs/${song.id}/sync`} className="song-learn-toggle-all">
                    가사 싱크 편집
                  </Link>
                )}
                {lines.length > 0 && (
                  <Link to={`/songs/${song.id}/edit`} className="song-learn-toggle-all">
                    가사 내용 편집
                  </Link>
                )}
                {lines.length > 0 && (
                  <button
                    type="button"
                    className="song-learn-toggle-all"
                    onClick={() => setExpandedAll((v) => !v)}
                  >
                    {expandedAll ? '한 줄씩 보기' : '전체 가사 보기'}
                  </button>
                )}
              </div>
            </div>

            {lines.length === 0 ? (
              <div className="song-learn-status">아직 등록된 가사가 없어요.</div>
            ) : expandedAll ? (
              <>
                <div className="song-learn-lyrics" onClick={() => setActiveWordKey(null)}>
                  {lines.map((line, idx) => (
                    <div
                      key={line.id}
                      id={`line-${line.id}`}
                      className={`song-learn-line${line.id === activeGrammarLineId ? ' song-learn-line--highlight' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        focusLine(idx)
                      }}
                    >
                      {line.reading && <span className="song-learn-line-reading">{line.reading}</span>}
                      <span className="song-learn-line-original">
                        {renderOriginalWithWords(line, activeWordKey, toggleWord)}
                      </span>
                      <span className="song-learn-line-translation">{line.translationNatural}</span>
                    </div>
                  ))}
                </div>
                <p className="song-learn-word-hint">소절을 탭하면 그 줄만 자세히 볼 수 있어요.</p>
              </>
            ) : (
              <div className="song-learn-focus">
                {activeLine && (
                  <>
                    <div className="song-learn-focus-card" onClick={() => setActiveWordKey(null)}>
                      {activeLine.reading && (
                        <span className="song-learn-focus-reading">{activeLine.reading}</span>
                      )}
                      <span className="song-learn-focus-original">
                        {renderOriginalWithWords(activeLine, activeWordKey, toggleWord)}
                      </span>
                      <span className="song-learn-focus-translation">{activeLine.translationNatural}</span>
                    </div>

                    <div className="song-learn-focus-nav">
                      <button
                        type="button"
                        className="song-learn-focus-nav-btn"
                        onClick={() => focusLine(Math.max(0, clampedIndex - 1))}
                        disabled={clampedIndex === 0}
                        aria-label="이전 소절"
                      >
                        ‹
                      </button>
                      <span className="song-learn-focus-count">{clampedIndex + 1} / {lines.length}</span>
                      <button
                        type="button"
                        className="song-learn-focus-nav-btn"
                        onClick={() => focusLine(Math.min(lines.length - 1, clampedIndex + 1))}
                        disabled={clampedIndex === lines.length - 1}
                        aria-label="다음 소절"
                      >
                        ›
                      </button>
                    </div>

                    {activeWordList.length > 0 && (
                      <div className="song-learn-focus-words">
                        <span className="song-learn-focus-words-title">이 소절의 단어</span>
                        <div className="song-learn-word-table">
                          {activeWordList.map((w) => (
                            <div className="song-learn-word-row" key={w.key}>
                              <span className="song-learn-word-row-surface">
                                {w.surface}
                                {w.reading && <span className="song-learn-word-row-reading">{w.reading}</span>}
                              </span>
                              <span className="song-learn-word-row-meaning">{w.meaning}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        </div>
        </div>
        </div>
      )}
    </div>
  )
}
