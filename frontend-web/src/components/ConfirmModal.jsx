import './ConfirmModal.css'

// 네이티브 window.confirm() 대신 쓰는 공용 확인 창 — 단어장(Wordbook.jsx)의
// "새 폴더 만들기" 창과 같은 스타일(흰 카드 + 취소/확인 버튼)로 통일한다
// (2026-10-07 피드백: 브라우저 기본 확인창이 디자인과 어울리지 않는다는 지적).
// 특정 페이지에 종속되지 않도록 components/로 분리해서 StudySession.jsx 같은
// 다른 페이지에서도 그대로 쓸 수 있게 했다.
export default function ConfirmModal({
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="confirm-modal-backdrop" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-modal-title">{title}</h3>
        {message && <p className="confirm-modal-sub">{message}</p>}
        <div className="confirm-modal-actions">
          <button type="button" className="confirm-modal-cancel-btn" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-modal-confirm-btn${danger ? ' confirm-modal-confirm-btn--danger' : ''}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
