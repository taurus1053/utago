import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSong, updateSongSync } from '../api/songs'
import TopBar from '../components/TopBar'
import useYoutubeApiReady from '../hooks/useYoutubeApiReady'
import './SongSync.css'

// mm:ss 형식으로 ms를 표시.
function formatMs(ms) {
  if (ms == null) return '--:--'
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// 소절 원문을 한자 위에 후리가나(ruby)로 보여주기 위한 조각화 — SongLearn.jsx와 같은 패턴.
// 글을 천천히 읽는 사용자도 타이밍을 쉽게 맞출 수 있도록, 싱크 편집 화면에도 후리가나와
// (line.reading의) 한국어 발음 표기를 같이 보여준다.
function rubyOrPlain(surface, furigana) {
  return (
    <ruby>
      {surface}
      {/* 빈 rt의 자리표시 문자는 반드시 nbsp( ) — 보통 스페이스는 CSS 공백 접기 때문에
          rt 안에서 빈 내용 취급되어 높이가 0이 되고, 후리가나 유무로 줄 높이가 달라지는
          버그가 재발한다(SongLearn.jsx와 동일 원인, 실측 확인됨). */}
      <rt className={furigana ? undefined : 'song-sync-rt-empty'}>{furigana || ' '}</rt>
    </ruby>
  )
}

function renderOriginalWithWords(line) {
  const text = line.originalText
  const words = line.words ?? []
  if (words.length === 0) {
    return <span key="plain-only">{rubyOrPlain(text, null)}</span>
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
    nodes.push(
      <span key={`${line.id}-${i}`}>{rubyOrPlain(surface, w.furigana)}</span>
    )
    cursor = w.charOffsetEnd
  })
  if (cursor < text.length) {
    nodes.push(<span key="plain-end">{rubyOrPlain(text.slice(cursor), null)}</span>)
  }
  return nodes
}

// 지금 탭할 소절(tapIndex) 전후 한 줄씩만 "맥락"으로 같이 보여준다(총 3줄 유지) — 전후
// 가사를 너무 많이 보여주면 영역이 길어져서 오히려 한눈에 안 들어오니, 방금 지나간 줄과
// 곧 나올 줄 딱 하나씩만 흐리게 보여줘서 다음 탭 타이밍을 예측하는 데 필요한 만큼만 둔다.
const CONTEXT_BEFORE = 1
const CONTEXT_AFTER = 1

// 가사 싱크(탭싱크) 편집 화면 — 유튜브 영상을 재생하면서, 화면에 띄워준 "다음 소절"이
// 실제로 노래에서 나오는 순간 탭(또는 스페이스바)하면 그 시점을 그 소절의 시작 시각으로
// 기록한다. 직전 소절의 끝 시각은 자동으로 "이번 탭 시각"이 된다(줄 사이에 빈틈이 없게).
// 마지막 소절은 영상 길이를 알 수 있으면 그걸로, 모르면 4초 뒤로 끝을 잡는다.
//
// 곡을 등록한 본인만 저장할 수 있다(서버가 확인, 아니면 403). 저장한 사용자가 ADMIN이면
// 서버가 이 타이밍을 같은 유튜브 영상의 공유 캐시(SongSyncCache)에도 반영해서, 이후 같은
// 영상으로 곡을 등록하는 다른 사용자들도 자동으로 이 타이밍을 재사용하게 된다.
export default function SongSync() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [song, setSong] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const apiReady = useYoutubeApiReady()
  const [isPlaying, setIsPlaying] = useState(false)
  const [timings, setTimings] = useState([])
  const [tapIndex, setTapIndex] = useState(0)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const playerRef = useRef(null)

  const lines = song?.lines ?? []

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getSong(id)
      .then((data) => {
        if (cancelled) return
        setSong(data)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    setTimings(new Array(lines.length).fill(null))
    setTapIndex(0)
    setSaveSuccess(false)
  }, [song?.id, lines.length])

  // API 준비 + 곡 정보(영상 ID) 준비되면 플레이어 생성(한 번만).
  useEffect(() => {
    if (!apiReady || !song?.youtubeVideoId || playerRef.current) return
    playerRef.current = new window.YT.Player('song-sync-yt-player', {
      videoId: song.youtubeVideoId,
      playerVars: { rel: 0 },
      events: {
        onStateChange: (e) => {
          setIsPlaying(e.data === window.YT.PlayerState.PLAYING)
        },
      },
    })
  }, [apiReady, song])

  function handleTap() {
    const player = playerRef.current
    if (!player || typeof player.getCurrentTime !== 'function' || tapIndex >= lines.length) return
    const nowMs = Math.round(player.getCurrentTime() * 1000)
    const isLast = tapIndex === lines.length - 1
    const duration = typeof player.getDuration === 'function' ? player.getDuration() : 0
    const endMs = isLast && duration > 0 ? Math.round(duration * 1000) : nowMs + 4000

    setTimings((prev) => {
      const next = [...prev]
      next[tapIndex] = { startMs: nowMs, endMs }
      if (tapIndex > 0 && next[tapIndex - 1]) {
        next[tapIndex - 1] = { ...next[tapIndex - 1], endMs: nowMs }
      }
      return next
    })
    setTapIndex((i) => i + 1)
    setSaveSuccess(false)
  }

  function handleUndo() {
    if (tapIndex === 0) return
    setTimings((prev) => {
      const next = [...prev]
      next[tapIndex - 1] = null
      return next
    })
    setTapIndex((i) => i - 1)
    setSaveSuccess(false)
  }

  function handleReset() {
    setTimings(new Array(lines.length).fill(null))
    setTapIndex(0)
    setSaveSuccess(false)
    const player = playerRef.current
    if (player && typeof player.seekTo === 'function') {
      player.seekTo(0, true)
      player.playVideo()
    }
  }

  function handlePlayPause() {
    const player = playerRef.current
    if (!player) return
    if (isPlaying) player.pauseVideo()
    else player.playVideo()
  }

  // 오른쪽 전체 타임라인에서 소절을 클릭하면 처음부터 다시 하지 않고 그 소절부터 바로
  // 이어서(또는 다시) 탭싱크를 할 수 있게 한다. 클릭한 소절부터 그 뒤 소절들의 기존 타이밍은
  // 지금부터 다시 찍을 것이므로 지워서 "완료" 표시가 헷갈리지 않게 하고, 그 소절에 이미
  // 알고 있는 시각(방금 지운 기존 탭 기록 또는 서버에 저장돼 있던 기존 startMs)이 있으면
  // 그보다 2초 앞으로 영상을 이동시켜서 다시 들어보고 정확한 순간에 탭할 수 있게 한다.
  // 지금 탭할 소절을 건너뛰고 다음 소절로 넘어간다 — 이미 맞는 타이밍이 있어서 다시 찍을
  // 필요가 없거나(사이드바에서 그 줄을 눌러 처음부터 다시 맞출 수도 있음), 간주/추임새처럼
  // 굳이 탭할 필요 없는 줄을 그냥 지나칠 때 쓴다. 기존 타이밍 기록은 건드리지 않는다.
  function handleSkipNext() {
    if (tapIndex >= lines.length - 1) return
    setTapIndex((i) => i + 1)
    setSaveSuccess(false)
  }

  function handleJumpTo(idx) {
    if (idx < 0 || idx >= lines.length || idx === tapIndex) return
    const anchorMs = timings[idx]?.startMs ?? lines[idx].startMs ?? null
    setTimings((prev) => {
      const next = [...prev]
      for (let i = idx; i < next.length; i++) next[i] = null
      return next
    })
    setTapIndex(idx)
    setSaveSuccess(false)
    const player = playerRef.current
    if (anchorMs != null && player && typeof player.seekTo === 'function') {
      player.seekTo(Math.max(0, anchorMs - 2000) / 1000, true)
      player.playVideo()
    }
  }

  // 스페이스바로도 탭 기록 — 입력창에 포커스가 있을 때는 무시(텍스트 입력 방해 방지).
  useEffect(() => {
    function onKeyDown(e) {
      if (e.code !== 'Space') return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      handleTap()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapIndex, lines])

  async function handleSave() {
    const payload = timings
      .map((t, idx) => (t ? { lineId: lines[idx].id, startMs: t.startMs, endMs: t.endMs } : null))
      .filter(Boolean)
    if (payload.length === 0) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateSongSync(song.id, payload)
      setSong(updated)
      setSaveSuccess(true)
    } catch (err) {
      setSaveError(err)
    } finally {
      setSaving(false)
    }
  }

  const doneCount = timings.filter(Boolean).length
  const allDone = lines.length > 0 && doneCount === lines.length
  const nextLine = tapIndex < lines.length ? lines[tapIndex] : null

  // 지금 탭할 소절이 항상 가운데(3줄 중 중간)에 오도록, 전/후 자리를 항상 고정으로 만든다.
  // 맨 첫 줄처럼 "이전 줄"이 없거나 맨 마지막 줄처럼 "다음 줄"이 없으면, 그 자리를 비워서
  // (line: null) 높이와 가운데 정렬을 그대로 유지한다 — 실제 가사가 없다고 2줄로 줄어들면
  // 지금 탭할 줄의 위치가 매번 위아래로 들쭉날쭉해 보인다.
  const contextItems = []
  for (let offset = -CONTEXT_BEFORE; offset <= CONTEXT_AFTER; offset++) {
    const idx = tapIndex + offset
    const role = offset < 0 ? 'past' : offset === 0 ? 'current' : 'future'
    contextItems.push({
      key: `ctx-${offset}`,
      idx,
      role,
      line: idx >= 0 && idx < lines.length ? lines[idx] : null,
    })
  }

  return (
    <div className="song-sync-page">
      <TopBar showSearch={false} />
      <div className="app-subbar">
        <button className="app-subbar-back" onClick={() => navigate(-1)} aria-label="뒤로 가기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span className="app-subbar-title">가사 싱크 편집</span>
      </div>

      {loading ? (
        <div className="song-sync-status">불러오는 중...</div>
      ) : loadError ? (
        <div className="song-sync-status song-sync-status--error">곡을 불러오지 못했어요.</div>
      ) : !song ? null : !song.youtubeVideoId ? (
        <div className="song-sync-status">이 곡은 등록된 유튜브 영상이 없어서 싱크를 맞출 수 없어요.</div>
      ) : (
        <div className="song-sync-content">
          <div className="song-sync-layout">
            <div className="song-sync-main">
              <div className="song-sync-video">
                <div id="song-sync-yt-player" />
              </div>

              <div className="song-sync-status-row">
                <span className="song-sync-progress">{doneCount} / {lines.length} 줄 완료</span>
                <div className="song-sync-controls">
                  {/* 재생/일시정지는 글자 수가 달라 버튼 폭이 들쭉날쭉했던 문제를 없애려고
                      항상 같은 크기의 아이콘 버튼으로 표시한다. */}
                  <button
                    type="button"
                    className="song-sync-icon-btn"
                    onClick={handlePlayPause}
                    disabled={!apiReady}
                    aria-label={isPlaying ? '일시정지' : '재생'}
                    title={isPlaying ? '일시정지' : '재생'}
                  >
                    {isPlaying ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1"></rect><rect x="14" y="4" width="5" height="16" rx="1"></rect></svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"></polygon></svg>
                    )}
                  </button>
                  <button type="button" className="song-sync-ctrl-btn" onClick={handleUndo} disabled={tapIndex === 0}>
                    이전 줄 다시
                  </button>
                  <button
                    type="button"
                    className="song-sync-ctrl-btn"
                    onClick={handleSkipNext}
                    disabled={tapIndex >= lines.length - 1}
                  >
                    다음 줄 이동
                  </button>
                  <button type="button" className="song-sync-ctrl-btn" onClick={handleReset} disabled={!apiReady}>
                    처음부터 다시
                  </button>
                  <button
                    type="button"
                    className="song-sync-save-btn"
                    onClick={handleSave}
                    disabled={saving || doneCount === 0}
                  >
                    {saving ? '저장 중...' : allDone ? '싱크 저장' : `${doneCount}줄만 저장`}
                  </button>
                </div>
              </div>
              {(saveError || saveSuccess) && (
                <div className="song-sync-save-msg-row">
                  {saveError && (
                    <span className="song-sync-save-error">
                      저장하지 못했어요. {saveError.status === 403 ? '본인이 등록한 곡만 싱크를 수정할 수 있어요.' : saveError.message}
                    </span>
                  )}
                  {saveSuccess && !saveError && <span className="song-sync-save-success">저장했어요!</span>}
                </div>
              )}

              {nextLine ? (
                <div className="song-sync-context">
                  <span className="song-sync-current-label">이 소절이 나오는 순간 탭하세요</span>
                  {contextItems.map(({ key, line, role }) => (
                    <div
                      key={key}
                      className={`song-sync-context-line song-sync-context-line--${role}${!line ? ' song-sync-context-line--empty' : ''}`}
                    >
                      {/* 빈 자리(이전/다음 가사 없음)든 실제 가사든, 그 역할(past/future/current)에
                          맞는 문단 구성(원문+발음[+번역])을 항상 똑같이 내보낸다 — 가사나 발음이
                          없을 때만 nbsp로 채우는 식으로 하면, 빈 자리에서 실제 가사로 바뀌는
                          순간 문단 개수가 달라져서 높이가 들쭉날쭉해진다(실측으로 재발 확인). */}
                      <p className="song-sync-context-original">
                        {line ? renderOriginalWithWords(line) : ' '}
                      </p>
                      <p className="song-sync-context-reading">{line?.reading || ' '}</p>
                      {role === 'current' && (
                        <p className="song-sync-context-translation">{line?.translationNatural || ' '}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : lines.length > 0 ? (
                <div className="song-sync-current">
                  <p className="song-sync-current-done">
                    모든 소절의 타이밍을 기록했어요. 저장하거나, 다시 맞추려면 "처음부터 다시"를 눌러주세요.
                  </p>
                </div>
              ) : (
                <div className="song-sync-current">
                  <p className="song-sync-current-done">이 곡에는 아직 가사가 없어요.</p>
                </div>
              )}

              <button
                type="button"
                className="song-sync-tap-btn"
                onClick={handleTap}
                disabled={!apiReady || tapIndex >= lines.length}
              >
                탭! <span className="song-sync-tap-hint">(스페이스바로도 가능)</span>
              </button>
            </div>

            <div className="song-sync-sidebar">
              <div className="song-sync-list">
                {lines.map((line, idx) => {
                  const tapped = timings[idx]
                  const isNext = idx === tapIndex
                  return (
                    <div
                      key={line.id}
                      className={`song-sync-row${isNext ? ' song-sync-row--next' : ''}${tapped ? ' song-sync-row--done' : ''}`}
                      onClick={() => handleJumpTo(idx)}
                      title="클릭하면 이 소절부터 다시 싱크를 맞출 수 있어요"
                    >
                      <span className="song-sync-row-time">
                        {tapped ? formatMs(tapped.startMs) : formatMs(line.startMs)}
                        {!tapped && <span className="song-sync-row-time-old">기존</span>}
                      </span>
                      <div className="song-sync-row-text-col">
                        <span className="song-sync-row-text">{renderOriginalWithWords(line)}</span>
                        {line.reading && <span className="song-sync-row-reading">{line.reading}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
