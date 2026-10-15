import { useTranslation } from 'react-i18next'
import './StudySession.css'

// "단어 학습하기" 버튼을 누르면(또는 학습 중 "메뉴로"를 누르면) 페이지 전환 없이 이 창이
// 떠서 학습 방법을 고를 수 있게 한다. 배경을 클릭하거나 닫기 버튼을 누르면 아무것도
// 바뀌지 않고 그냥 닫힌다(고르는 중이던 게임이 있었다면 그대로 유지).
// 각 방법의 이름/설명은 study 번역 파일의 methods.<id>.title / desc
const METHODS = [{ id: 'flashcard' }, { id: 'quiz' }, { id: 'fill' }, { id: 'reorder' }, { id: 'match' }]

export default function StudyMethodModal({ onSelect, onClose }) {
  const { t } = useTranslation('study')
  return (
    <div className="study-modal-backdrop" onClick={onClose}>
      <div className="study-modal" onClick={(e) => e.stopPropagation()}>
        <div className="study-modal-header">
          <h2 className="study-modal-title">{t('methodModal.title')}</h2>
          <button type="button" className="study-modal-close" onClick={onClose} aria-label={t('common:actions.close')}>
            ×
          </button>
        </div>
        <div className="study-menu-grid">
          {METHODS.map((m) => (
            <button type="button" key={m.id} className="study-menu-card" onClick={() => onSelect(m.id)}>
              <span className="study-menu-card-title">{t(`methods.${m.id}.title`)}</span>
              <span className="study-menu-card-desc">{t(`methods.${m.id}.desc`)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
