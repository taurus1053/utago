import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getSong, updateSongLines } from '../api/songs'
import TopBar from '../components/TopBar'
import './SongEdit.css'

// 가사 내용(원문/의역) 편집 화면 — 등록할 때 오탈자를 냈거나 나중에 잘못된 부분을 발견했을 때
// 고칠 수 있게 한다. 타이밍(가사 싱크)은 여기서 다루지 않는다 — SongSync가 따로 담당.
//
// 곡을 등록한 본인만 저장할 수 있다(서버가 확인, 아니면 403). 원문을 실제로 고친 줄은
// 저장 시 서버가 후리가나/단어장 연결/발음 표기를 자동으로 다시 만든다.
export default function SongEdit() {
  const { t } = useTranslation('song')
  const { id } = useParams()
  const navigate = useNavigate()

  const [song, setSong] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [edits, setEdits] = useState({}) // lineId -> { originalText, translationNatural }

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getSong(id)
      .then((data) => {
        if (cancelled) return
        setSong(data)
        setEdits({})
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

  const lines = song?.lines ?? []

  const dirtyCount = useMemo(() => {
    return Object.entries(edits).filter(([lineId, e]) => {
      const original = lines.find((l) => String(l.id) === String(lineId))
      if (!original) return false
      return e.originalText !== original.originalText || e.translationNatural !== original.translationNatural
    }).length
  }, [edits, lines])

  function valueFor(line, field) {
    return edits[line.id]?.[field] ?? line[field]
  }

  function handleChange(line, field, value) {
    setEdits((prev) => ({
      ...prev,
      [line.id]: {
        originalText: prev[line.id]?.originalText ?? line.originalText,
        translationNatural: prev[line.id]?.translationNatural ?? line.translationNatural,
        [field]: value,
      },
    }))
    setSaveSuccess(false)
  }

  async function handleSave() {
    const payload = lines
      .filter((line) => {
        const e = edits[line.id]
        if (!e) return false
        return e.originalText !== line.originalText || e.translationNatural !== line.translationNatural
      })
      .map((line) => ({
        lineId: line.id,
        originalText: edits[line.id].originalText,
        translationNatural: edits[line.id].translationNatural,
      }))
    if (payload.length === 0) return

    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateSongLines(song.id, payload)
      setSong(updated)
      setEdits({})
      setSaveSuccess(true)
    } catch (err) {
      setSaveError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="song-edit-page">
      <TopBar showSearch={false} />
      <div className="app-subbar">
        <button className="app-subbar-back" onClick={() => navigate(-1)} aria-label={t('common:actions.back')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span className="app-subbar-title">{t('edit.title')}</span>
      </div>

      {loading ? (
        <div className="song-edit-status">{t('common:actions.loading')}</div>
      ) : loadError ? (
        <div className="song-edit-status song-edit-status--error">{t('edit.loadError')}</div>
      ) : !song ? null : (
        <div className="song-edit-content">
          <div className="song-edit-header">
            <h1 className="song-edit-title">{song.title}</h1>
            <span className="song-edit-artist">{song.artist}</span>
          </div>
          <p className="song-edit-hint">
            {t('edit.hint')}
          </p>

          {lines.length === 0 ? (
            <div className="song-edit-status">{t('learn.noLyrics')}</div>
          ) : (
            <div className="song-edit-list">
              {lines.map((line) => (
                <div key={line.id} className="song-edit-row">
                  <span className="song-edit-row-order">{line.lineOrder}</span>
                  <div className="song-edit-row-fields">
                    <label className="song-edit-field">
                      <span className="song-edit-field-label">{t('edit.original')}</span>
                      <input
                        type="text"
                        className="song-edit-input"
                        value={valueFor(line, 'originalText')}
                        onChange={(e) => handleChange(line, 'originalText', e.target.value)}
                      />
                    </label>
                    <label className="song-edit-field">
                      <span className="song-edit-field-label">{t('edit.translation')}</span>
                      <input
                        type="text"
                        className="song-edit-input"
                        value={valueFor(line, 'translationNatural')}
                        onChange={(e) => handleChange(line, 'translationNatural', e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="song-edit-save-row">
            {saveError && (
              <span className="song-edit-save-error">
                {t('edit.saveFailed', { reason: saveError.status === 403 ? t('edit.forbidden') : saveError.message })}
              </span>
            )}
            {saveSuccess && !saveError && <span className="song-edit-save-success">{t('edit.saved')}</span>}
            <button
              type="button"
              className="song-edit-save-btn"
              onClick={handleSave}
              disabled={saving || dirtyCount === 0}
            >
              {saving ? t('edit.saving') : dirtyCount > 0 ? t('edit.saveCount', { count: dirtyCount }) : t('edit.noChanges')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
