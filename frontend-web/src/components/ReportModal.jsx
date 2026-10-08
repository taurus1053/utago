import { useState } from 'react'
import { createReport } from '../api/reports'
import { ApiError } from '../api/client'
import './ReportModal.css'

// 신고 사유 — 백엔드 ReportReason enum과 코드를 맞춰야 한다(report/ReportReason.java).
const REASON_OPTIONS = [
  { value: 'SPAM', label: '스팸/광고' },
  { value: 'ABUSE', label: '욕설/비방' },
  { value: 'ADULT', label: '음란물' },
  { value: 'COPYRIGHT', label: '저작권 침해' },
  { value: 'ETC', label: '기타' },
]

// 게시글/댓글 신고 모달 — ConfirmModal과 같은 배경/카드 스타일을 쓰되, 라디오 + 선택
// 상세 입력이 있어서 별도 컴포넌트로 분리했다(claude/소셜_마이페이지_기획.md 23번).
export default function ReportModal({ targetType, targetId, onSubmitted, onCancel }) {
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
      setError(err instanceof ApiError ? err.message : '신고를 접수하지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="report-modal-backdrop" onClick={onCancel}>
      <form className="report-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 className="report-modal-title">{targetType === 'POST' ? '게시글 신고' : '댓글 신고'}</h3>
        <p className="report-modal-sub">신고 사유를 선택해주세요. 접수된 신고는 운영진이 검토해요.</p>

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
              <span>{opt.label}</span>
            </label>
          ))}
        </div>

        <textarea
          className="report-modal-detail"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="상세 내용(선택)"
          maxLength={500}
          rows={3}
        />

        {error && <div className="report-modal-error">{error}</div>}

        <div className="report-modal-actions">
          <button type="button" className="report-modal-cancel-btn" onClick={onCancel} disabled={busy}>
            취소
          </button>
          <button type="submit" className="report-modal-confirm-btn" disabled={busy}>
            {busy ? '접수하는 중...' : '신고하기'}
          </button>
        </div>
      </form>
    </div>
  )
}
