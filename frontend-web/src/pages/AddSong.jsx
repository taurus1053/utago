import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createSong, extractYoutubeVideoId, lookupSongByYoutube, translateLines } from '../api/songs'
import { isLoggedIn } from '../api/auth'
import TopBar from '../components/TopBar'
import './AddSong.css'

// 곡 등록 화면.
// 가사 원문/번역은 직접 입력해야 한다 — 저작권이 있는 가사를 Claude/서버가 대신
// 채워주지 않는다(번역 초안은 AI가 도와줄 수 있지만 원문 자체는 항상 사용자가 입력).
// 소절 재생 타이밍은 아직 오디오 싱크 도구가 없어서 서버가 줄당 4초 간격으로 임시 배정한다
// (SongService 참고).
//
// 가사는 한 줄에 한 소절씩, 원문/번역 두 개의 큰 텍스트 영역에 통째로 붙여넣는 방식이다
// (예전엔 줄마다 입력칸이 따로 있었는데 불편해서 이렇게 바꿈) — 원문과 번역은 같은 줄
// 순서로 1:1 대응해야 한다.
//
// 등록된 곡은 항상 등록한 본인만 볼 수 있는 PRIVATE 곡이 된다 — 다른 사용자에게 공개되지
// 않는다(운영진이 저작권 문제를 해결한 곡만 별도로 공개 카탈로그로 승격). 로그인이 필요하다.

const LANG_OPTIONS = [
  { value: 'JA', label: '일본어' },
  { value: 'KO', label: '한국어' },
  { value: 'EN', label: '영어' },
]

function splitLines(text) {
  return text.split('\n').map((l) => l.trim())
}

export default function AddSong() {
  const navigate = useNavigate()
  const loggedIn = isLoggedIn()

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [sourceLang, setSourceLang] = useState('JA')
  const [youtubeVideoId, setYoutubeVideoId] = useState('')
  const [originalText, setOriginalText] = useState('')
  const [translationText, setTranslationText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const originalLines = splitLines(originalText)
  const translationLines = splitLines(translationText)
  const nonEmptyCount = originalLines.filter(Boolean).length
  const missingTranslationLine = originalLines.findIndex((o, i) => o && !translationLines[i])
  const lineCountMismatch = missingTranslationLine !== -1

  // AI 번역 초안 받기 — 원문만 보내고, 돌아온 번역은 빈 줄에만 채워준다(이미 손으로
  // 적어둔 번역은 덮어쓰지 않음). 사용자가 그대로 두거나 고친 뒤 제출해야 실제로 저장된다.
  const [translating, setTranslating] = useState(false)
  const [translateNotice, setTranslateNotice] = useState(null)

  async function handleTranslate() {
    const targets = originalLines
      .map((text, i) => ({ i, text }))
      .filter((t) => t.text)
    if (targets.length === 0) {
      setTranslateNotice({ type: 'error', text: '먼저 가사 원문을 입력해주세요.' })
      return
    }
    setTranslating(true)
    setTranslateNotice(null)
    try {
      const result = await translateLines(sourceLang, targets.map((t) => t.text))
      if (!result.available || result.translations.length !== targets.length) {
        setTranslateNotice({
          type: 'error',
          text: 'AI 번역을 지금은 사용할 수 없어요. 직접 입력해주세요.',
        })
        return
      }
      const nextTranslationLines = originalLines.map((_, i) => translationLines[i] ?? '')
      targets.forEach((t, idx) => {
        if (!nextTranslationLines[t.i]) {
          nextTranslationLines[t.i] = result.translations[idx]
        }
      })
      setTranslationText(nextTranslationLines.join('\n'))
      setTranslateNotice({ type: 'success', text: 'AI가 번역 초안을 채웠어요. 소절별로 어색한 부분은 바로 밑칸에서 고쳐주세요.' })
    } catch (err) {
      setTranslateNotice({ type: 'error', text: err.message })
    } finally {
      setTranslating(false)
    }
  }

  // 번역 칸은 소절(원문 줄)마다 하나씩 — 원문 줄 바로 밑에서 그 줄의 번역만 고칠 수 있게
  // translationText를 줄 단위로 갱신한다. translationText 자체는 여전히 '\n'으로 합쳐진
  // 하나의 문자열 상태로 관리해서(제출 로직/AI 초안 채우기 로직과 호환) 개별 줄 변경 시
  // 배열로 풀었다가 다시 합친다.
  function handleTranslationLineChange(index, value) {
    const next = originalLines.map((_, i) => translationLines[i] ?? '')
    next[index] = value
    setTranslationText(next.join('\n'))
  }

  // 유튜브 링크로 제목/아티스트 자동 채우기 + 중복 확인.
  // 영상 ID는 여기서만 채워진다 — 따로 수동 입력칸을 두지 않는다(링크 하나로 충분).
  // 가사는 여기서 절대 채워지지 않는다 — 위 handleTranslate 참고.
  const [youtubeLinkInput, setYoutubeLinkInput] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState(null)
  const [existingMatch, setExistingMatch] = useState(null) // { songId }

  async function handleLookup() {
    const videoId = extractYoutubeVideoId(youtubeLinkInput)
    if (!videoId) {
      setLookupError('유튜브 링크에서 영상 ID를 찾지 못했어요. youtu.be/... 또는 youtube.com/watch?v=... 형식으로 넣어주세요.')
      return
    }
    setLookupLoading(true)
    setLookupError(null)
    setExistingMatch(null)
    try {
      const result = await lookupSongByYoutube(videoId)
      if (result.matchedExisting) {
        setExistingMatch({ songId: result.existingSongId })
      } else {
        setYoutubeVideoId(videoId)
        if (result.suggestedTitle) setTitle(result.suggestedTitle)
        if (result.suggestedArtist) setArtist(result.suggestedArtist)
        if (!result.suggestedTitle && !result.suggestedArtist) {
          setLookupError('영상 정보를 가져오지 못했어요 — 제목/아티스트를 직접 입력해주세요. 영상은 연결해뒀어요.')
        }
      }
    } catch (err) {
      setLookupError(err.message)
    } finally {
      setLookupLoading(false)
    }
  }

  const canSubmit =
    loggedIn &&
    title.trim() &&
    artist.trim() &&
    sourceLang &&
    nonEmptyCount > 0 &&
    !lineCountMismatch &&
    !submitting

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const linesPayload = originalLines
        .map((o, i) => ({ originalText: o, translationNatural: translationLines[i] || '' }))
        .filter((l) => l.originalText)
      const created = await createSong({
        title: title.trim(),
        artist: artist.trim(),
        sourceLang,
        youtubeVideoId: youtubeVideoId.trim() || null,
        lines: linesPayload,
      })
      navigate(`/songs/${created.id}`)
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="add-song-page">
      <TopBar showSearch={false} />
      <div className="app-subbar">
        <button className="app-subbar-back" onClick={() => navigate(-1)} aria-label="뒤로 가기">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span className="app-subbar-title">곡 추가</span>
      </div>

      <form className="add-song-content" onSubmit={handleSubmit}>
        <p className="add-song-notice">
          가사 원문은 직접 입력해주세요 — 저작권이 있는 가사를 자동으로 채워드릴 수는 없어요.
          본인이 작성했거나 사용 권리가 있는 텍스트만 입력해주세요. 등록한 곡은 본인만 볼 수 있는
          나만의 곡으로 저장돼요(다른 사용자에게 공개되지 않아요).
        </p>

        {!loggedIn && (
          <p className="add-song-notice add-song-notice--warn">
            로그인 후에 곡을 등록할 수 있어요.{' '}
            <Link to="/login">로그인하러 가기 →</Link>
          </p>
        )}

        <section className="add-song-section">
          <span className="add-song-label">유튜브 링크로 시작하기 (선택)</span>
          <p className="add-song-lookup-desc">
            이미 등록된 곡이면 바로 그 곡으로 안내해드리고, 아니면 영상 제목/채널명을 참고해서
            제목·아티스트를 미리 채우고 영상도 자동으로 연결해드려요. 가사는 여전히 직접 입력해야 해요.
          </p>
          <div className="add-song-lookup-row">
            <input
              value={youtubeLinkInput}
              onChange={(e) => setYoutubeLinkInput(e.target.value)}
              placeholder="youtu.be/... 또는 youtube.com/watch?v=..."
            />
            <button type="button" className="add-song-lookup-btn" onClick={handleLookup} disabled={lookupLoading}>
              {lookupLoading ? '확인 중...' : '가져오기'}
            </button>
          </div>
          {lookupError && <div className="add-song-error">{lookupError}</div>}
          {existingMatch && (
            <div className="add-song-existing-match">
              이미 등록된 곡이에요!{' '}
              <Link to={`/songs/${existingMatch.songId}`}>바로 학습하러 가기 →</Link>
            </div>
          )}
          {youtubeVideoId && !existingMatch && (
            <div className="add-song-lookup-linked">✓ 영상이 연결됐어요 ({youtubeVideoId})</div>
          )}
        </section>

        <section className="add-song-section">
          <label className="add-song-field">
            <span className="add-song-label">곡 제목</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 踊り子" />
          </label>
          <label className="add-song-field">
            <span className="add-song-label">아티스트</span>
            <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="예: Vaundy" />
          </label>
          <label className="add-song-field">
            <span className="add-song-label">원어</span>
            <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="add-song-section">
          <div className="add-song-section-header">
            <span className="add-song-label">가사 원문</span>
          </div>
          <p className="add-song-lookup-desc">한 줄에 한 소절씩, 통째로 붙여넣으세요.</p>
          <textarea
            className="add-song-lyrics-textarea"
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            placeholder={'가사 원문을 한 줄에 한 소절씩 붙여넣으세요\n예)\n첫 번째 소절\n두 번째 소절'}
            rows={10}
          />
        </section>

        <section className="add-song-section">
          <div className="add-song-section-header">
            <span className="add-song-label">번역 (소절별로)</span>
            <button
              type="button"
              className="add-song-translate-btn"
              onClick={handleTranslate}
              disabled={translating || nonEmptyCount === 0}
            >
              {translating ? 'AI 번역 중...' : 'AI 번역 초안 받기'}
            </button>
          </div>
          <p className="add-song-lookup-desc">
            원문 소절 바로 밑에 그 줄의 번역을 입력하세요 — 어디가 맞고 틀렸는지 한눈에 확인할 수 있어요.
            AI 번역 초안은 비어있는 칸만 채워요(이미 적어둔 번역은 덮어쓰지 않아요).
          </p>
          {translateNotice && (
            <div className={`add-song-translate-notice add-song-translate-notice--${translateNotice.type}`}>
              {translateNotice.text}
            </div>
          )}
          {nonEmptyCount === 0 ? (
            <p className="add-song-lyrics-empty-hint">
              먼저 위에 가사 원문을 입력하면 여기에 소절별 번역 칸이 하나씩 생겨요.
            </p>
          ) : (
            <div className="add-song-lyric-rows">
              {originalLines.map((line, i) =>
                line ? (
                  <div className="add-song-lyric-row" key={i}>
                    <div className="add-song-lyric-row-original">
                      <span className="add-song-lyric-row-num">{i + 1}</span>
                      {line}
                    </div>
                    <input
                      className="add-song-lyric-row-translation"
                      value={translationLines[i] ?? ''}
                      onChange={(e) => handleTranslationLineChange(i, e.target.value)}
                      placeholder="이 소절의 번역을 입력하세요"
                    />
                  </div>
                ) : (
                  <div className="add-song-lyric-row-spacer" key={i} />
                )
              )}
            </div>
          )}
          {lineCountMismatch && (
            <div className="add-song-error">
              {missingTranslationLine + 1}번째 줄의 번역이 비어있어요.
            </div>
          )}
        </section>

        {error && <div className="add-song-error">{error.message}</div>}

        <button type="submit" className="add-song-submit" disabled={!canSubmit}>
          {submitting ? '등록 중...' : '곡 등록하고 학습 화면으로'}
        </button>
      </form>
    </div>
  )
}
