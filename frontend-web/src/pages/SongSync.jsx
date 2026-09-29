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
          <div className="song-sync-video">
            <div id="song-sync-yt-player" />
          </div>

          <div className="song-sync-status-row">
            <span className="song-sync-progress">{doneCount} / {lines.length} 줄 완료</span>
            <div className="song-sync-controls">
              <button type="button" className="song-sync-ctrl-btn" onClick={handlePlayPause} disabled={!apiReady}>
                {isPlaying ? '일시정지' : '재생'}
              </button>
              <button type="button" className="song-sync-ctrl-btn" onClick={handleUndo} disabled={tapIndex === 0}>
                이전 줄 다시
              </button>
              <button type="button" className="song-sync-ctrl-btn" onClick={handleReset} disabled={!apiReady}>
                처음부터 다시
              </button>
            </div>
          </div>

          <div className="song-sync-current">
            {nextLine ? (
              <>
                <span className="song-sync-current-label">이 소절이 나오는 순간 탭하세요</span>
                <p className="song-sync-current-original">{nextLine.originalText}</p>
                <p className="song-sync-current-translation">{nextLine.translationNatural}</p>
              </>
            ) : lines.length > 0 ? (
              <p className="song-sync-current-done">
                모든 소절의 타이밍을 기록했어요. 저장하거나, 다시 맞추려면 "처음부터 다시"를 눌러주세요.
              </p>
            ) : (
              <p className="song-sync-current-done">이 곡에는 아직 가사가 없어요.</p>
            )}
          </div>

          <button
            type="button"
            className="song-sync-tap-btn"
            onClick={handleTap}
            disabled={!apiReady || tapIndex >= lines.length}
          >
            탭! <span className="song-sync-tap-hint">(스페이스바로도 가능)</span>
          </button>

          <div className="song-sync-list">
            {lines.map((line, idx) => {
              const tapped = timings[idx]
              const isNext = idx === tapIndex
              return (
                <div
                  key={line.id}
                  className={`song-sync-row${isNext ? ' song-sync-row--next' : ''}${tapped ? ' song-sync-row--done' : ''}`}
                >
                  <span className="song-sync-row-time">
                    {tapped ? formatMs(tapped.startMs) : formatMs(line.startMs)}
                    {!tapped && <span className="song-sync-row-time-old">기존</span>}
                  </span>
                  <span className="song-sync-row-text">{line.originalText}</span>
                </div>
              )
            })}
          </div>

          <div className="song-sync-save-row">
            {saveError && (
              <span className="song-sync-save-error">
                저장하지 못했어요. {saveError.status === 403 ? '본인이 등록한 곡만 싱크를 수정할 수 있어요.' : saveError.message}
              </span>
            )}
            {saveSuccess && !saveError && <span className="song-sync-save-success">저장했어요!</span>}
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
      )}
    </div>
  )
}
