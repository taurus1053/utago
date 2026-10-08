import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getSong, updateSongProgress } from '../api/songs'
import { addWordbookItem, createWordbook, getWordbookMembership, listWordbooks } from '../api/wordbook'
import { isLoggedIn } from '../api/auth'
import { sendStudyPing } from '../api/users'
import TopBar from '../components/TopBar'
import useYoutubeApiReady from '../hooks/useYoutubeApiReady'
import './SongLearn.css'

const LANG_LABEL = { JA: '일본어', KO: '한국어', EN: '영어' }

// 소절 원문을 단어 단위(line.words, 서버에서 형태소 분석으로 만들어줌)로 쪼개서
// 한자 위에 후리가나(ruby)를 보여줄 수 있게 조각낸다. (단어 탭 시 뜻 팝업은 더 이상 없음 —
// 뜻은 "이 소절의 단어" 목록에서 확인한다.)
// words가 없는 곡(일본어가 아니거나 아직 분석 전)은 그냥 원문 텍스트 그대로 보여준다.
// 후리가나가 있는 단어와 없는 단어가 소절마다 섞여 있으면, 그 소절에 ruby(후리가나) 태그가
// 하나라도 있는지 여부에 따라 그 줄의 높이가 들쭉날쭉해진다(브라우저가 rt 높이만큼 줄 높이를
// 늘리기 때문). 그래서 후리가나가 없는 단어도 항상 <ruby>로 감싸되, 안 보이는(투명) 빈 rt를
// 넣어서 — 실제 발음이 있든 없든 모든 소절이 항상 같은 높이를 갖도록 한다.
function rubyOrPlain(surface, furigana) {
  return (
    <ruby>
      {surface}
      {/* 빈 rt의 자리표시 문자는 반드시 nbsp( )여야 한다 — 보통 스페이스(' ')는 CSS
          공백 접기 규칙 때문에 rt 안에서 사실상 빈 내용으로 취급돼 높이가 0이 되어버려서,
          후리가나 유무로 줄 높이가 달라지는 바로 그 버그가 재발한다(실측 확인됨). */}
      <rt className={furigana ? undefined : 'song-learn-rt-empty'}>{furigana || ' '}</rt>
    </ruby>
  )
}

function renderOriginalWithWords(line) {
  const text = line.originalText
  const words = line.words ?? []
  if (words.length === 0) {
    // 단어가 하나도 인식 안 된 소절(감탄사 등)도 다른 소절과 똑같이 <ruby>로 감싸야 한다 —
    // 그냥 텍스트만 반환하면 이 소절엔 rt(후리가나 자리)가 아예 없어서, 후리가나가 있는
    // 다른 소절들보다 줄 높이가 낮아져 버린다(레이아웃이 소절마다 들쭉날쭉 움직이는 원인).
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
  const [activeLineIndex, setActiveLineIndex] = useState(0)
  const [expandedAll, setExpandedAll] = useState(false)
  const [autoSync, setAutoSync] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [durationMs, setDurationMs] = useState(0)
  const [currentMs, setCurrentMs] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekPreviewMs, setSeekPreviewMs] = useState(0)

  // 로그인 사용자의 단어장 목록(단어장 선택 창에 띄울 용도) — 로그인 상태에서 한 번만 불러온다.
  const [wordbooks, setWordbooks] = useState([])
  // 지금 소절의 단어들이 이미 어느 단어장(들)에 담겨 있는지: { [lemma]: [wordbookId, ...] }
  // 서버에서 다시 조회해오기 때문에, 페이지를 나갔다 다시 들어와도 체크 표시가 유지된다.
  const [membershipByLemma, setMembershipByLemma] = useState({})
  // "단어장에 추가" 버튼을 누르면 뜨는, 어느 단어장에 담을지 고르는 창. null이면 닫힘.
  const [wordPicker, setWordPicker] = useState(null) // { key, lemma } | null
  const [pickerCreating, setPickerCreating] = useState(false)
  const [pickerNewName, setPickerNewName] = useState('')
  const [pickerSavingNew, setPickerSavingNew] = useState(false)
  const [pickerBusyId, setPickerBusyId] = useState(null)

  const apiReady = useYoutubeApiReady()
  const playerRef = useRef(null)

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

  // 로그인 상태면, 단어장 선택 창에서 바로 고를 수 있도록 내 단어장 목록을 한 번 불러온다.
  useEffect(() => {
    if (!isLoggedIn()) return
    listWordbooks()
      .then((data) => setWordbooks(data ?? []))
      .catch(() => {
        // 실패해도 무시 — 선택 창을 열 때 다시 시도할 수 있다(openWordPicker에서 재조회하지는
        // 않지만, 페이지를 새로고침하면 다시 시도된다).
      })
  }, [])

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

  // 소절이 바뀔 때마다, 이번 소절 단어들이 이미 어느 단어장에 담겨 있는지 서버에 물어본다 —
  // 로컬 상태만 쓰면 다른 페이지 갔다가 돌아왔을 때 체크 표시가 풀려 보이는 문제가 있었다.
  useEffect(() => {
    if (!isLoggedIn() || !song?.sourceLang || activeWordList.length === 0) return
    let cancelled = false
    const lemmas = activeWordList.map((w) => w.surface)
    getWordbookMembership(lemmas, song.sourceLang)
      .then((data) => {
        if (cancelled) return
        setMembershipByLemma((prev) => ({ ...prev, ...(data ?? {}) }))
      })
      .catch(() => {
        // 실패해도 무시 — 체크 표시가 잠깐 안 보일 뿐, 다시 추가를 시도하면 정상 동작한다.
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLineIndex, song?.id])

  // 소절이 바뀔 때마다(디바운스 1초) 이어 학습 지점을 서버에 저장 — 마이페이지 학습 통계
  // (완료한 가사/곡)·연속 학습일의 원천 데이터가 된다(claude/소셜_마이페이지_기획.md 10번).
  // 로그인 안 했으면 호출 자체를 생략(서버도 비로그인이면 조용히 무시하긴 하지만, 불필요한
  // 요청을 아예 안 보내는 게 낫다).
  useEffect(() => {
    if (!isLoggedIn() || !song?.id) return
    const timer = setTimeout(() => {
      updateSongProgress(song.id, clampedIndex).catch(() => {
        // 실패해도 무시 — 통계 집계가 이번 한 번 빠질 뿐, 다음 소절 이동 때 다시 시도된다.
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [clampedIndex, song?.id])

  // 학습 화면에 머무는 동안 30초마다 "체류시간 하트비트"를 보낸다 — 누적 학습시간
  // 칭호(1/5/10/30/50/100시간, claude/소셜_마이페이지_기획.md 15-6번)의 원천 데이터.
  // 화면을 벗어나거나(언마운트) 곡이 바뀌면 인터벌이 정리되므로, 탭을 백그라운드에 두고
  // 떠나있던 시간까지 과도하게 집계되진 않는다(최대 30초 단위로만 더해짐).
  useEffect(() => {
    if (!isLoggedIn() || !song?.id) return
    const STUDY_PING_INTERVAL_MS = 30000
    const interval = setInterval(() => {
      sendStudyPing(STUDY_PING_INTERVAL_MS / 1000).catch(() => {
        // 실패해도 무시 — 이번 한 번 하트비트가 빠질 뿐, 다음 주기에 다시 시도된다.
      })
    }, STUDY_PING_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [song?.id])

  const displayMs = isSeeking ? seekPreviewMs : currentMs
  const seekPercent = durationMs > 0 ? Math.min(100, Math.max(0, (displayMs / durationMs) * 100)) : 0

  function focusLine(idx) {
    setActiveLineIndex(idx)
    setExpandedAll(false)
  }

  // "한 줄씩 보기"에서 ◀/▶로 소절을 직접 넘길 때 — 자동 싱크가 켜져 있으면 영상도
  // 그 소절의 싱크 지점으로 같이 이동시켜서, 가사 탐색과 영상 재생이 어긋나지 않게 한다.
  function goToLine(idx) {
    focusLine(idx)
    if (autoSync) {
      seekToLineStart(idx)
    }
  }

  // 영상을 특정 소절의 시작 지점으로 이동시킨다. 보기 모드(한 줄씩/전체 가사)는 건드리지 않는다 —
  // "전체 가사 보기"에서 가사를 클릭했을 때도 이 함수만 써서 보기가 끊기지 않게 한다.
  function seekToLineStart(idx) {
    const line = lines[idx]
    if (!line) return
    const player = playerRef.current
    if (player && typeof player.seekTo === 'function') {
      player.seekTo(line.startMs / 1000, true)
    }
    setCurrentMs(line.startMs)
    setActiveLineIndex(idx)
  }

  // "이 소절의 단어" 목록에서 단어장 아이콘 버튼 — 비로그인이면 로그인 화면으로 보내고,
  // 로그인 상태면 "어느 단어장에 담을지" 고르는 창을 띄운다. 이미 담겨 있는 단어라도 다른
  // 단어장에 또 넣고 싶을 수 있으니, 클릭하면 항상 이 창이 뜬다(자동으로 즐겨찾기에 담지 않음).
  function openWordPicker(key, lemma) {
    if (!isLoggedIn()) {
      navigate('/login')
      return
    }
    setPickerCreating(false)
    setPickerNewName('')
    setWordPicker({ key, lemma })
  }

  function closeWordPicker() {
    setWordPicker(null)
    setPickerCreating(false)
    setPickerNewName('')
  }

  // 단어장 선택 창에서 단어장 하나를 골랐을 때 — 이미 그 단어장에 있는 단어면 한 번 더
  // 확인하고, 아니면 바로 담는다.
  async function handlePickWordbook(book) {
    if (!wordPicker || !song?.sourceLang || pickerBusyId) return
    const lemma = wordPicker.lemma
    const alreadyIn = (membershipByLemma[lemma] ?? []).includes(book.id)
    if (alreadyIn) {
      const ok = window.confirm(`선택하신 단어장에 이미 단어가 있습니다. 한 번 더 추가할까요?`)
      if (!ok) return
    }
    setPickerBusyId(book.id)
    try {
      await addWordbookItem({ lemma, lang: song.sourceLang, wordbookId: book.id })
      setMembershipByLemma((prev) => {
        const existing = prev[lemma] ?? []
        return existing.includes(book.id) ? prev : { ...prev, [lemma]: [...existing, book.id] }
      })
      if (!alreadyIn) {
        setWordbooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, itemCount: b.itemCount + 1 } : b)))
      }
      closeWordPicker()
    } catch {
      // 실패해도 창은 그대로 열어둬서 다시 시도할 수 있게 한다.
    } finally {
      setPickerBusyId(null)
    }
  }

  function openPickerCreate() {
    setPickerCreating(true)
    setPickerNewName('')
  }

  async function handlePickerCreateSubmit(e) {
    e.preventDefault()
    const name = pickerNewName.trim()
    if (!name || pickerSavingNew) return
    setPickerSavingNew(true)
    try {
      const created = await createWordbook(name)
      setWordbooks((prev) => [...prev, created])
      setPickerCreating(false)
      setPickerNewName('')
    } catch {
      // 실패해도 입력값은 남겨서 다시 시도할 수 있게 한다.
    } finally {
      setPickerSavingNew(false)
    }
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
                <span className={`song-learn-lang-badge song-learn-lang-badge--${song.sourceLang}`}>{LANG_LABEL[song.sourceLang] ?? song.sourceLang}</span>
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
                  className={`song-learn-player-seek${isSeeking ? ' song-learn-player-seek--active' : ''}`}
                  min={0}
                  max={durationMs || 0}
                  step={100}
                  value={isSeeking ? seekPreviewMs : Math.min(currentMs, durationMs || 0)}
                  onChange={(e) => {
                    setIsSeeking(true)
                    setSeekPreviewMs(Number(e.target.value))
                  }}
                  onMouseDown={() => {
                    setSeekPreviewMs(Math.min(currentMs, durationMs || 0))
                    setIsSeeking(true)
                  }}
                  onTouchStart={() => {
                    setSeekPreviewMs(Math.min(currentMs, durationMs || 0))
                    setIsSeeking(true)
                  }}
                  onMouseUp={(e) => commitSeek(Number(e.target.value))}
                  onTouchEnd={(e) => commitSeek(Number(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, #5f26f3 0%, #8d47fa ${seekPercent}%, #ececec ${seekPercent}%, #ececec 100%)`,
                  }}
                  aria-label="재생 위치"
                />
                <span className="song-learn-player-time">{formatTime(durationMs)}</span>
              </div>
            )}
          </section>
        </div>

        <div className="song-learn-right">
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
            ) : (
              <div className="song-learn-lyrics-viewport">
                {expandedAll ? (
                  <>
                    <div className="song-learn-lyrics">
                      {lines.map((line, idx) => (
                        <div
                          key={line.id}
                          id={`line-${line.id}`}
                          className="song-learn-line"
                          onClick={() => seekToLineStart(idx)}
                        >
                          {line.reading && <span className="song-learn-line-reading">{line.reading}</span>}
                          <span className="song-learn-line-original">
                            {renderOriginalWithWords(line)}
                          </span>
                          <span className="song-learn-line-translation">{line.translationNatural}</span>
                        </div>
                      ))}
                    </div>
                    <p className="song-learn-word-hint">소절을 탭하면 영상이 그 지점으로 이동해요.</p>
                  </>
                ) : (
                  <div className="song-learn-focus">
                    {activeLine && (
                      <>
                        <div className="song-learn-focus-card">
                          {activeLine.reading && (
                            <span className="song-learn-focus-reading">{activeLine.reading}</span>
                          )}
                          <span className="song-learn-focus-original">
                            {renderOriginalWithWords(activeLine)}
                          </span>
                          <span className="song-learn-focus-translation">{activeLine.translationNatural}</span>
                        </div>

                        <div className="song-learn-focus-nav">
                          <button
                            type="button"
                            className="song-learn-focus-nav-btn"
                            onClick={() => goToLine(Math.max(0, clampedIndex - 1))}
                            disabled={clampedIndex === 0}
                            aria-label="이전 소절"
                          >
                            ‹
                          </button>
                          <span className="song-learn-focus-count">{clampedIndex + 1} / {lines.length}</span>
                          <button
                            type="button"
                            className="song-learn-focus-nav-btn"
                            onClick={() => goToLine(Math.min(lines.length - 1, clampedIndex + 1))}
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
                              {activeWordList.map((w) => {
                                const inWordbook = (membershipByLemma[w.surface] ?? []).length > 0
                                return (
                                <div className="song-learn-word-row" key={w.key}>
                                  <span className="song-learn-word-row-surface">
                                    {w.surface}
                                    {w.reading && <span className="song-learn-word-row-reading">{w.reading}</span>}
                                  </span>
                                  <span className="song-learn-word-row-meaning">{w.meaning}</span>
                                  <button
                                    type="button"
                                    className={`song-learn-word-row-add${inWordbook ? ' song-learn-word-row-add--done' : ''}`}
                                    onClick={() => openWordPicker(w.key, w.surface)}
                                    aria-label={inWordbook ? '단어장에 담김 — 다른 단어장에도 추가' : '단어장에 추가'}
                                    title={inWordbook ? '단어장에 담김 — 다른 단어장에도 추가' : '단어장에 추가'}
                                  >
                                    {inWordbook ? (
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                      </svg>
                                    ) : (
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21 12 16.5 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"></path>
                                        <line x1="9.5" y1="8.5" x2="14.5" y2="8.5"></line>
                                        <line x1="12" y1="6" x2="12" y2="11"></line>
                                      </svg>
                                    )}
                                  </button>
                                </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {song.grammarPoints?.length > 0 && (
                          <Link to={`/songs/${song.id}/grammar`} className="song-learn-grammar-cta">
                            📖 문법 보기
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
        </div>
        </div>
      )}

      {/* 단어장 선택 창 — 다운로드할 때 저장 폴더를 고르는 창처럼, 여기서 폴더(단어장)를
          고르거나 바로 새 폴더(단어장)를 만들 수 있다. */}
      {wordPicker && (
        <div className="word-picker-overlay" onClick={closeWordPicker}>
          <div className="word-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="word-picker-header">
              <span className="word-picker-title">
                <strong>{wordPicker.lemma}</strong> 단어를 어느 단어장에 담을까요?
              </span>
              <button type="button" className="word-picker-close" onClick={closeWordPicker} aria-label="닫기">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="word-picker-list">
              {wordbooks.map((book) => {
                const already = (membershipByLemma[wordPicker.lemma] ?? []).includes(book.id)
                return (
                  <button
                    type="button"
                    key={book.id}
                    className="word-picker-item"
                    onClick={() => handlePickWordbook(book)}
                    disabled={pickerBusyId === book.id}
                  >
                    <span className="word-picker-item-icon">{book.favoriteDefault ? '★' : '📁'}</span>
                    <span className="word-picker-item-name">{book.name}</span>
                    <span className="word-picker-item-count">{book.itemCount}개</span>
                    {already && <span className="word-picker-item-already">담김</span>}
                  </button>
                )
              })}
            </div>

            {pickerCreating ? (
              <form className="word-picker-create-form" onSubmit={handlePickerCreateSubmit}>
                <input
                  type="text"
                  className="word-picker-create-input"
                  placeholder="새 단어장 이름"
                  value={pickerNewName}
                  onChange={(e) => setPickerNewName(e.target.value)}
                  autoFocus
                  maxLength={60}
                />
                <button type="submit" className="word-picker-create-confirm" disabled={pickerSavingNew}>
                  {pickerSavingNew ? '만드는 중...' : '만들기'}
                </button>
              </form>
            ) : (
              <button type="button" className="word-picker-create-open" onClick={openPickerCreate}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                새 단어장 만들기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
