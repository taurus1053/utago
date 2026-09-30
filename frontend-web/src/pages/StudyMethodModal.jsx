import './StudySession.css'

// "단어 학습하기" 버튼을 누르면(또는 학습 중 "메뉴로"를 누르면) 페이지 전환 없이 이 창이
// 떠서 학습 방법을 고를 수 있게 한다. 배경을 클릭하거나 닫기 버튼을 누르면 아무것도
// 바뀌지 않고 그냥 닫힌다(고르는 중이던 게임이 있었다면 그대로 유지).
const METHODS = [
  { id: 'flashcard', title: '플래시카드', desc: '단어를 보고 뜻을 떠올려본 뒤 확인해요.' },
  { id: 'quiz', title: '의미 맞추기 퀴즈', desc: '단어를 보고 맞는 뜻을 4개 중에 골라요.' },
  { id: 'fill', title: '빈칸 채우기', desc: '실제 가사 소절에서 빈칸에 들어갈 단어를 골라요.' },
  { id: 'reorder', title: '문장 배열하기', desc: '뒤섞인 글자를 원래 가사 순서대로 맞춰요.' },
  { id: 'match', title: '카드 맞추기', desc: '단어 카드와 뜻 카드를 짝지어요.' },
]

export default function StudyMethodModal({ onSelect, onClose }) {
  return (
    <div className="study-modal-backdrop" onClick={onClose}>
      <div className="study-modal" onClick={(e) => e.stopPropagation()}>
        <div className="study-modal-header">
          <h2 className="study-modal-title">어떤 방법으로 학습할까요?</h2>
          <button type="button" className="study-modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="study-menu-grid">
          {METHODS.map((m) => (
            <button type="button" key={m.id} className="study-menu-card" onClick={() => onSelect(m.id)}>
              <span className="study-menu-card-title">{m.title}</span>
              <span className="study-menu-card-desc">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
