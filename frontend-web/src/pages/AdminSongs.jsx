import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getMyRole, createAiLearningSong } from '../api/admin'
import { extractYoutubeVideoId, lookupSongByYoutube, translateLines } from '../api/songs'
import './AdminTranslations.css'
import './AddSong.css'

// 관리자 전용 — AI로 만든 "학습곡"(멜로디·보컬·가사까지 AI로 제작한 뒤 관리자가 유튜브에
// 올려 가져온 곡)을 공개 카탈로그에 바로 등록하는 화면.
//
// 일반 곡 등록(AddSong)과 입력 형태는 거의 같지만(유튜브 링크로 시작 → 제목/아티스트/원어 →
// 가사 원문/번역), 저장 결과가 다르다 — 여기서 등록한 곡은 처음부터 PUBLIC + AI_GENERATED로
// 저장되어 홈 화면 "전체 곡" 섹션에 바로 노출된다(AddSong으로 등록한 곡은 항상 PRIVATE).
//
// 접근 제어는 AdminTranslations와 동일한 방식 — 이 화면 자체가 GET /api/users/me/role을
// 불러서 ADMIN이 아니면 접근을 막는다. 백엔드(AdminSongController)도 매 요청마다 동일하게
// 확인하므로 이건 UX용 가드일 뿐 실제 보안은 서버가 담당.

const LANG_OPTIONS = [
  { value: 'JA', label: '일본어' },
  { value: 'KO', label: '한국어' },
  { value: 'EN', label: '영어' },
]

function splitLines(text) {
  return text.split('\n').map((l) => l.trim())
}

// translationText는 소절별 입력칸에 한 글자씩 타이핑해서 채워가는 상태라, splitLines처럼 줄마다
// trim()을 하면 방금 입력한 줄 끝의 띄어쓰기가 리렌더마다 즉시 지워져버린다(커서가 줄 끝에
// 있는 한 스페이스바가 전혀 안 먹히는 것처럼 보임). trim은 통째로 붙여넣는 원문
// 텍스트영역(originalLines)에만 필요하므로, 번역 줄은 trim 없이 그대로 쪼갠다.
function splitLinesRaw(text) {
  return text.split('\n')
}

export default function AdminSongs() {
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

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [sourceLang, setSourceLang] = useState('JA')
  const [youtubeVideoId, setYoutubeVideoId] = useState('')
  const [originalText, setOriginalText] = useState('')
  const [translationText, setTranslationText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const originalLines = splitLines(originalText)
  const translationLines = splitLinesRaw(translationText)
  const nonEmptyCount = originalLines.filter(Boolean).length
  const missingTranslationLine = originalLines.findIndex((o, i) => o && !translationLines[i])
  const lineCountMismatch = missingTranslationLine !== -1

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

  // 이미 번역을 다 준비해 온 경우 — 번역 전체를 한 번에 붙여넣으면, 원문과 줄 개수가 똑같을
  // 때만 순서대로 자동으로 매칭해서 각 소절 입력칸에 채워준다(AddSong.jsx와 동일한 패턴).
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false)
  const [bulkPasteText, setBulkPasteText] = useState('')
  const [bulkPasteNotice, setBulkPasteNotice] = useState(null)

  function handleBulkPasteApply() {
    const targets = originalLines
      .map((text, i) => ({ i, text }))
      .filter((t) => t.text)
    const pastedLines = bulkPasteText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (targets.length === 0) {
      setBulkPasteNotice({ type: 'error', text: '먼저 위에 가사 원문을 입력해주세요.' })
      return
    }
    if (pastedLines.length === 0) {
      setBulkPasteNotice({ type: 'error', text: '번역을 붙여넣어주세요.' })
      return
    }
    if (pastedLines.length !== targets.length) {
      setBulkPasteNotice({
        type: 'error',
        text: `줄 개수가 달라요 — 원문은 ${targets.length}줄인데 붙여넣은 번역은 ${pastedLines.length}줄이에요. 빈 줄 없이 원문과 똑같은 줄 수로 맞춰서 다시 붙여넣어주세요.`,
      })
      return
    }
    const nextTranslationLines = originalLines.map((_, i) => translationLines[i] ?? '')
    targets.forEach((t, idx) => {
      nextTranslationLines[t.i] = pastedLines[idx]
    })
    setTranslationText(nextTranslationLines.join('\n'))
    setBulkPasteText('')
    setBulkPasteOpen(false)
    setBulkPasteNotice(null)
    setTranslateNotice({ type: 'success', text: `${pastedLines.length}줄을 자동으로 매칭해서 채웠어요. 혹시 밀린 줄이 없는지 한 번 확인해주세요.` })
  }

  function handleTranslationLineChange(index, value) {
    const next = originalLines.map((_, i) => translationLines[i] ?? '')
    next[index] = value
    setTranslationText(next.join('\n'))
  }

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
        .map((o, i) => ({ originalText: o, translationNatural: (translationLines[i] || '').trim() }))
        .filter((l) => l.originalText)
      const created = await createAiLearningSong({
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
        <span className="admin-tr-topbar-title">AI 학습곡 등록</span>
        <Link to="/admin/featured-songs" className="admin-song-nav-link">추천곡 관리 →</Link>
        <Link to="/admin/translations" className="admin-song-nav-link admin-song-nav-link--plain">번역 캐시 관리 →</Link>
      </header>

      <form className="admin-tr-content add-song-content" onSubmit={handleSubmit}>
        <p className="admin-tr-notice">
          여기서 등록한 곡은 <strong>처음부터 전체 공개(AI 학습곡)</strong>로 저장돼서 홈 화면
          "전체 곡" 섹션에 바로 노출됩니다. AI로 작사·작곡·보컬까지 만든 뒤 관리자 유튜브
          채널에 올린 영상을 가져와서 등록하세요. 가사 원문/번역은 여기서도 직접 입력해야 해요.
        </p>

        <section className="add-song-section">
          <span className="add-song-label">유튜브 링크로 시작하기</span>
          <p className="add-song-lookup-desc">
            우타고 유튜브 채널에 올린 AI 학습곡 영상 링크를 넣으면 제목·아티스트를 미리 채우고
            영상도 자동으로 연결해드려요. 가사는 여전히 직접 입력해야 해요.
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
            <div className="add-song-section-header-actions">
              <button
                type="button"
                className="add-song-translate-btn"
                onClick={() => {
                  setBulkPasteOpen((v) => !v)
                  setBulkPasteNotice(null)
                }}
                disabled={nonEmptyCount === 0}
              >
                번역 붙여넣고 자동매칭
              </button>
              <button
                type="button"
                className="add-song-translate-btn"
                onClick={handleTranslate}
                disabled={translating || nonEmptyCount === 0}
              >
                {translating ? 'AI 번역 중...' : 'AI 번역 초안 받기'}
              </button>
            </div>
          </div>
          <p className="add-song-lookup-desc">
            원문 소절 바로 밑에 그 줄의 번역을 입력하세요. AI 번역 초안은 비어있는 칸만
            채워요(이미 적어둔 번역은 덮어쓰지 않아요). 이미 번역을 다 준비해왔다면 "번역 붙여넣고
            자동매칭"으로 통째로 붙여넣어도 돼요 — 원문과 줄 개수가 똑같을 때만 순서대로 채워줘요.
          </p>
          {bulkPasteOpen && (
            <div className="add-song-bulk-paste">
              <textarea
                className="add-song-lyrics-textarea"
                value={bulkPasteText}
                onChange={(e) => setBulkPasteText(e.target.value)}
                placeholder={'준비해온 번역을 한 줄에 한 소절씩, 원문과 같은 줄 수로 붙여넣으세요'}
                rows={8}
              />
              {bulkPasteNotice && (
                <div className={`add-song-translate-notice add-song-translate-notice--${bulkPasteNotice.type}`}>
                  {bulkPasteNotice.text}
                </div>
              )}
              <button type="button" className="add-song-lookup-btn" onClick={handleBulkPasteApply}>
                자동으로 채우기
              </button>
            </div>
          )}
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
          {submitting ? '등록 중...' : 'AI 학습곡으로 전체 공개 등록'}
        </button>
      </form>
    </div>
  )
}
