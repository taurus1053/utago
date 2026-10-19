import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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

const LANG_CODES = ['JA', 'KO', 'EN']

function splitLines(text) {
  return text.split('\n').map((l) => l.trim())
}

// translationText는 사용자가 소절별 입력칸에 한 글자씩 타이핑해서 채워가는 상태라, splitLines처럼
// 줄마다 trim()을 하면 지금 막 입력한 줄 끝의 띄어쓰기가 리렌더마다 즉시 지워져버린다(커서가
// 줄 끝에 있는 한 스페이스바가 전혀 안 먹히는 것처럼 보임). trim은 "통째로 붙여넣는" 원문
// 텍스트영역(originalLines)에만 필요하므로, 번역 줄은 trim 없이 그대로 쪼갠다.
function splitLinesRaw(text) {
  return text.split('\n')
}

export default function AddSong() {
  const navigate = useNavigate()
  const { t: tr } = useTranslation('song')
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
  const translationLines = splitLinesRaw(translationText)
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
      setTranslateNotice({ type: 'error', text: tr('add.needOriginal') })
      return
    }
    setTranslating(true)
    setTranslateNotice(null)
    try {
      const result = await translateLines(sourceLang, targets.map((t) => t.text))
      if (!result.available || result.translations.length !== targets.length) {
        setTranslateNotice({
          type: 'error',
          text: tr('add.aiUnavailable'),
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
      setTranslateNotice({ type: 'success', text: tr('add.aiDone') })
    } catch (err) {
      setTranslateNotice({ type: 'error', text: err.message })
    } finally {
      setTranslating(false)
    }
  }

  // 이미 번역을 다 준비해 온 경우(직접 작업했거나 다른 곳에서 번역했거나) — 번역 전체를
  // 한 번에 붙여넣으면, 원문과 줄 개수가 똑같을 때만 순서대로 자동으로 매칭해서 각 소절
  // 입력칸에 채워준다. 줄 개수가 다르면(붙여넣은 쪽에 줄이 더 많거나 적으면) 잘못 밀려서
  // 엉뚱한 소절에 들어갈 수 있으므로 아예 채우지 않고 안내만 한다.
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false)
  const [bulkPasteText, setBulkPasteText] = useState('')
  const [bulkPasteNotice, setBulkPasteNotice] = useState(null)

  function handleBulkPasteApply() {
    const targets = originalLines
      .map((text, i) => ({ i, text }))
      .filter((t) => t.text)
    const pastedLines = bulkPasteText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (targets.length === 0) {
      setBulkPasteNotice({ type: 'error', text: tr('add.needOriginalAbove') })
      return
    }
    if (pastedLines.length === 0) {
      setBulkPasteNotice({ type: 'error', text: tr('add.needPaste') })
      return
    }
    if (pastedLines.length !== targets.length) {
      setBulkPasteNotice({
        type: 'error',
        text: tr('add.countMismatch', { original: targets.length, pasted: pastedLines.length }),
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
    setTranslateNotice({ type: 'success', text: tr('add.bulkDone', { count: pastedLines.length }) })
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
      setLookupError(tr('add.ytParseFail'))
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
          setLookupError(tr('add.ytInfoFail'))
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
        .map((o, i) => ({ originalText: o, translationNatural: (translationLines[i] || '').trim() }))
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
        <button className="app-subbar-back" onClick={() => navigate(-1)} aria-label={tr('common:actions.back')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span className="app-subbar-title">{tr('add.title')}</span>
      </div>

      <form className="add-song-content" onSubmit={handleSubmit}>
        <p className="add-song-notice">
          {tr('add.copyright')}
        </p>

        {!loggedIn && (
          <p className="add-song-notice add-song-notice--warn">
            {tr('add.loginWarn')}{' '}
            <Link to="/login">{tr('add.loginLink')}</Link>
          </p>
        )}

        <section className="add-song-section">
          <span className="add-song-label">{tr('add.ytLabel')}</span>
          <p className="add-song-lookup-desc">
            {tr('add.ytDesc')}
          </p>
          <div className="add-song-lookup-row">
            <input
              value={youtubeLinkInput}
              onChange={(e) => setYoutubeLinkInput(e.target.value)}
              placeholder={tr('add.ytPlaceholder')}
            />
            <button type="button" className="add-song-lookup-btn" onClick={handleLookup} disabled={lookupLoading}>
              {lookupLoading ? tr('add.ytChecking') : tr('add.ytFetch')}
            </button>
          </div>
          {lookupError && <div className="add-song-error">{lookupError}</div>}
          {existingMatch && (
            <div className="add-song-existing-match">
              {tr('add.existing')}{' '}
              <Link to={`/songs/${existingMatch.songId}`}>{tr('add.existingGo')}</Link>
            </div>
          )}
          {youtubeVideoId && !existingMatch && (
            <div className="add-song-lookup-linked">{tr('add.linked', { id: youtubeVideoId })}</div>
          )}
        </section>

        <section className="add-song-section">
          <label className="add-song-field">
            <span className="add-song-label">{tr('add.songTitle')}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('add.titlePh')} />
          </label>
          <label className="add-song-field">
            <span className="add-song-label">{tr('add.artist')}</span>
            <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder={tr('add.artistPh')} />
          </label>
          <label className="add-song-field">
            <span className="add-song-label">{tr('add.sourceLang')}</span>
            <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
              {LANG_CODES.map((code) => (
                <option key={code} value={code}>{tr(`common:langName.${code}`)}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="add-song-section">
          <div className="add-song-section-header">
            <span className="add-song-label">{tr('add.origLabel')}</span>
          </div>
          <p className="add-song-lookup-desc">{tr('add.origHint')}</p>
          <textarea
            className="add-song-lyrics-textarea"
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            placeholder={tr('add.origPh')}
            rows={10}
          />
        </section>

        <section className="add-song-section">
          <div className="add-song-section-header">
            <span className="add-song-label">{tr('add.transLabel')}</span>
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
                {tr('add.bulkBtn')}
              </button>
              <button
                type="button"
                className="add-song-translate-btn"
                onClick={handleTranslate}
                disabled={translating || nonEmptyCount === 0}
              >
                {translating ? tr('add.aiBusy') : tr('add.aiBtn')}
              </button>
            </div>
          </div>
          <p className="add-song-lookup-desc">
            {tr('add.transDesc')}
          </p>
          {bulkPasteOpen && (
            <div className="add-song-bulk-paste">
              <textarea
                className="add-song-lyrics-textarea"
                value={bulkPasteText}
                onChange={(e) => setBulkPasteText(e.target.value)}
                placeholder={tr('add.bulkPh')}
                rows={8}
              />
              {bulkPasteNotice && (
                <div className={`add-song-translate-notice add-song-translate-notice--${bulkPasteNotice.type}`}>
                  {bulkPasteNotice.text}
                </div>
              )}
              <button type="button" className="add-song-lookup-btn" onClick={handleBulkPasteApply}>
                {tr('add.bulkApply')}
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
              {tr('add.emptyHint')}
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
                      placeholder={tr('add.linePh')}
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
              {tr('add.missingLine', { n: missingTranslationLine + 1 })}
            </div>
          )}
        </section>

        {error && <div className="add-song-error">{error.message}</div>}

        <button type="submit" className="add-song-submit" disabled={!canSubmit}>
          {submitting ? tr('add.submitting') : tr('add.submit')}
        </button>
      </form>
    </div>
  )
}
