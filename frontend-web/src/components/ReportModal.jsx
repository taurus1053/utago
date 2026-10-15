import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createReport } from '../api/reports'
import { ApiError } from '../api/client'
import './ReportModal.css'

// 신고 사유 — 백엔드 ReportReason enum과 코드를 맞춰야 한다(report/ReportReason.java).
// (표시 문구는 화면에서 t(`report.reason.${value}`)로 번역한다)
const REASON_OPTIONS = [
  { value: 'SPAM' },
  { value: 'ABUSE' },
  { value: 'ADULT' },
  { value: 'COPYRIGHT' },
  { value: 'ETC' },
]

// 게시글/댓글 신고 모달 — ConfirmModal과 같은 배경/카드 스타일을 쓰되, 라디오 + 선택
// 상세 입력이 있어서 별도 컴포넌트로 분리했다(claude/소셜_마이페이지_기획.md 23번).
export default function ReportModal({ targetType, targetId, onSubmitted, onCancel }) {
  const { t } = useTranslation('board')
  const [reason, setReason] = useState('SPAM')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await createReport({ targetType, targetId, reason, detail: detail.trim() })
      onSubmitted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('report.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="report-modal-backdrop" onClick={onCancel}>
      <form className="report-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 className="report-modal-title">{targetType === 'POST' ? t('report.titlePost') : t('report.titleComment')}</h3>
        <p className="report-modal-sub">{t('report.sub')}</p>

        <div className="report-modal-reasons">
          {REASON_OPTIONS.map((opt) => (
            <label key={opt.value} className="report-modal-reason">
              <input
                type="radio"
                name="report-reason"
                value={opt.value}
                checked={reason === opt.value}
                onChange={() => setReason(opt.value)}
              />
              <span>{t(`report.reason.${opt.value}`)}</span>
            </label>
          ))}
        </div>

        <textarea
          className="report-modal-detail"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder={t('report.detailPlaceholder')}
          maxLength={500}
          rows={3}
        />

        {error && <div className="report-modal-error">{error}</div>}

        <div className="report-modal-actions">
          <button type="button" className="report-modal-cancel-btn" onClick={onCancel} disabled={busy}>
            {t('common:actions.cancel')}
          </button>
          <button type="submit" className="report-modal-confirm-btn" disabled={busy}>
            {busy ? t('report.submitting') : t('report.submit')}
          </button>
        </div>
      </form>
    </div>
  )
}
