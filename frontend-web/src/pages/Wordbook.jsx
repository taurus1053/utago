import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  addCustomWordbookItem,
  addWordbookItem,
  createWordbook,
  createWordbookFolder,
  deleteWordbook,
  deleteWordbookFolder,
  listWordbookFolders,
  listWordbookItems,
  listWordbooks,
  lookupWordbookWord,
  moveWordbookToFolder,
  removeWordbookItem,
  renameWordbook,
  renameWordbookFolder,
  reviewWordbookItem,
  setWordbookVisibility,
  toggleWordbookItemStar,
  updateWordbookItemWord,
} from '../api/wordbook'
import TopBar from '../components/TopBar'
import StudySession from './StudySession'
import StudyMethodModal from './StudyMethodModal'
import './Wordbook.css'

// 학습횟수(repetitionCount) 구간별 배지 색 — SRS 복습 간격/완료 여부와는 별개로, 단순히
// "이 단어를 몇 번 맞혔는지"를 한눈에 보여주는 용도. 구간이 올라갈수록 파스텔 배경이
// 회색 → 파랑 → 청록 → 초록 → 주황 → 골드로 진해진다.
function repetitionTierClass(count) {
  if (count >= 30) return 'wordbook-detail-badge--tier5'
  if (count >= 20) return 'wordbook-detail-badge--tier4'
  if (count >= 15) return 'wordbook-detail-badge--tier3'
  if (count >= 10) return 'wordbook-detail-badge--tier2'
  if (count >= 5) return 'wordbook-detail-badge--tier1'
  return ''
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
    </svg>
  )
}

// 선택한 단어들을 다른 단어장으로 옮길 때 뜨는 작은 창. 옮길 수 있는 단어장이 없으면
// (단어장이 지금 것 하나뿐이면) 안내만 보여준다.
function WordbookMoveModal({ books, currentId, busy, onMove, onClose }) {
  const options = books.filter((b) => String(b.id) !== String(currentId))
  return (
    <div className="wordbook-modal-backdrop" onClick={onClose}>
      <div className="wordbook-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="wordbook-modal-title">다른 단어장으로 이동</h3>
        <p className="wordbook-modal-sub">선택한 단어를 옮길 단어장을 골라주세요.</p>
        {options.length === 0 ? (
          <p className="wordbook-modal-empty">이동할 수 있는 다른 단어장이 없어요. 왼쪽에서 새 단어장을 먼저 만들어보세요.</p>
        ) : (
          <div className="wordbook-modal-list">
            {options.map((b) => (
              <button
                type="button"
                key={b.id}
                className="wordbook-modal-option"
                disabled={busy}
                onClick={() => onMove(b.id)}
              >
                <span>{b.favoriteDefault ? '★ ' : '📁 '}{b.name}</span>
                <span>{b.itemCount}개</span>
              </button>
            ))}
          </div>
        )}
        <button type="button" className="wordbook-modal-close-btn" onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}

// 네이티브 <select>는 옵션 목록이 브라우저(OS) 기본 스타일로 떠서 디자인을 맞출 수 없으니,
// 버튼 + 드롭다운 패널로 직접 만든 폴더 선택기. 바깥을 클릭하면 닫힌다.
function FolderSelect({ folders, value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const selected = folders.find((f) => String(f.id) === String(value))

  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', handleOutside)
    return () => window.removeEventListener('mousedown', handleOutside)
  }, [open])

  return (
    <div className="wordbook-folder-select" ref={wrapRef}>
      <button
        type="button"
        className="wordbook-folder-select-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="wordbook-folder-select-value">{selected ? `📁 ${selected.name}` : '폴더 선택 안함'}</span>
        <svg
          className={`wordbook-folder-select-chevron${open ? ' wordbook-folder-select-chevron--open' : ''}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      {open && (
        <div className="wordbook-folder-select-panel">
          <button
            type="button"
            className={`wordbook-folder-select-option${!value ? ' wordbook-folder-select-option--active' : ''}`}
            onClick={() => { onChange(''); setOpen(false) }}
          >
            폴더 선택 안함
          </button>
          {folders.length === 0 ? (
            <div className="wordbook-folder-select-empty">만든 폴더가 없어요</div>
          ) : (
            folders.map((f) => (
              <button
                type="button"
                key={f.id}
                className={`wordbook-folder-select-option${String(value) === String(f.id) ? ' wordbook-folder-select-option--active' : ''}`}
                onClick={() => { onChange(String(f.id)); setOpen(false) }}
              >
                📁 {f.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// "+" 버튼 → 폴더/단어장 고르면 뜨는 새로 만들기 창. 사이드바에 바로 인라인으로 폼을
// 넣는 대신 별도 창으로 띄워서, 이름(+ 단어장이면 넣을 폴더)을 여유 있게 입력하게 한다.
function WordbookCreateModal({ type, name, onNameChange, folders, folderId, onFolderChange, busy, error, onSubmit, onClose, inputRef }) {
  return (
    <div className="wordbook-modal-backdrop" onClick={onClose}>
      <div className="wordbook-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="wordbook-modal-title">{type === 'folder' ? '📁 새 폴더 만들기' : '📖 새 단어장 만들기'}</h3>
        <form onSubmit={onSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="wordbook-create-modal-input"
            placeholder={type === 'folder' ? '폴더 이름' : '단어장 이름'}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
            }}
            maxLength={60}
            autoFocus
          />
          {type === 'wordbook' && (
            <FolderSelect folders={folders} value={folderId} onChange={onFolderChange} />
          )}
          {error && <p className="wordbook-create-modal-error">{error}</p>}
          <div className="wordbook-create-modal-actions">
            <button type="button" className="wordbook-modal-close-btn" onClick={onClose}>취소</button>
            <button type="submit" className="wordbook-create-modal-submit" disabled={busy || !name.trim()}>
              {busy ? '만드는 중...' : '만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 단어장 화면 "단어 추가" 창 — 가사에 없는 단어를 직접 입력해서 현재 단어장에 담는다.
//
// 단어 칸에 입력하면(디바운스 500ms) 서버에 자동 조회해서 발음/뜻 칸을 채워준다. 이미 한
// 번 채워진 뒤에 사용자가 발음/뜻을 직접 고치면 그 칸은 "손댄 것"으로 표시해서, 그 뒤에
// 단어 칸을 또 고쳐도 자동 채우기가 그 칸을 덮어쓰지 않는다(애써 고친 걸 날리지 않기 위해).
// 처음 조회하는 단어는 서버가 JMdict+AI 번역을 돌리느라 몇 초 걸릴 수 있지만, 한 번
// 조회되면 마스터 사전에 캐시돼서 다음부터는(이 사용자든 다른 사용자든) 즉시 채워진다.
function AddWordModal({ bookName, busy, error, onSubmit, onClose }) {
  const [lemma, setLemma] = useState('')
  const [reading, setReading] = useState('')
  const [meaningsText, setMeaningsText] = useState('')
  const [readingTouched, setReadingTouched] = useState(false)
  const [meaningsTouched, setMeaningsTouched] = useState(false)
  const [looking, setLooking] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const lookupTimer = useRef(null)
  const lookupSeq = useRef(0)

  useEffect(() => {
    clearTimeout(lookupTimer.current)
    const trimmed = lemma.trim()
    if (!trimmed) {
      setLooking(false)
      setNotFound(false)
      return
    }
    // 사용자가 발음/뜻 둘 다 이미 직접 입력해뒀으면 자동 조회로 덮어쓸 칸이 없으니 건너뛴다.
    if (readingTouched && meaningsTouched) {
      return
    }
    lookupTimer.current = setTimeout(async () => {
      const seq = ++lookupSeq.current
      setLooking(true)
      try {
        const result = await lookupWordbookWord(trimmed, 'JA')
        if (seq !== lookupSeq.current) return // 그 사이 단어 칸이 또 바뀌었으면 이 결과는 버린다
        if (!readingTouched) setReading(result?.reading ?? '')
        if (!meaningsTouched) setMeaningsText((result?.meanings ?? []).join('\n'))
        setNotFound(!result?.found)
      } catch {
        if (seq === lookupSeq.current) setNotFound(false)
      } finally {
        if (seq === lookupSeq.current) setLooking(false)
      }
    }, 500)
    return () => clearTimeout(lookupTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lemma])

  function handleSubmit(e) {
    e.preventDefault()
    const meanings = meaningsText.split('\n').map((s) => s.trim()).filter(Boolean)
    onSubmit({ lemma: lemma.trim(), reading: reading.trim(), meanings })
  }

  return (
    <div className="wordbook-modal-backdrop" onClick={onClose}>
      <div className="wordbook-modal wordbook-modal--wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="wordbook-modal-title">단어 추가</h3>
        <p className="wordbook-modal-sub">"{bookName}"에 담을 일본어 단어를 입력해주세요. 발음·뜻은 자동으로 채워지고, 틀린 부분은 직접 고칠 수 있어요.</p>
        <form onSubmit={handleSubmit}>
          <label className="wordbook-add-word-field">
            <span className="wordbook-add-word-label">단어</span>
            <input
              type="text"
              className="wordbook-create-modal-input"
              placeholder="예: 食べる, たべる"
              value={lemma}
              onChange={(e) => setLemma(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onClose()
              }}
              maxLength={60}
              autoFocus
            />
          </label>
          <label className="wordbook-add-word-field">
            <span className="wordbook-add-word-label">
              발음{looking && <span className="wordbook-add-word-looking"> · 찾는 중...</span>}
            </span>
            <input
              type="text"
              className="wordbook-create-modal-input"
              placeholder="예: たべる"
              value={reading}
              onChange={(e) => { setReading(e.target.value); setReadingTouched(true) }}
              maxLength={120}
            />
          </label>
          <label className="wordbook-add-word-field">
            <span className="wordbook-add-word-label">의미 (한 줄에 하나씩)</span>
            <textarea
              className="wordbook-create-modal-input wordbook-add-word-textarea"
              placeholder={'예: 먹다'}
              value={meaningsText}
              onChange={(e) => { setMeaningsText(e.target.value); setMeaningsTouched(true) }}
              rows={3}
              maxLength={300}
            />
          </label>
          {notFound && !looking && (
            <p className="wordbook-add-word-hint">사전에 없는 단어예요. 발음과 뜻을 직접 입력해주세요.</p>
          )}
          {error && <p className="wordbook-create-modal-error">{error}</p>}
          <div className="wordbook-create-modal-actions">
            <button type="button" className="wordbook-modal-close-btn" onClick={onClose}>취소</button>
            <button type="submit" className="wordbook-create-modal-submit" disabled={busy || !lemma.trim()}>
              {busy ? '추가하는 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 단어장 목록 행의 연필 아이콘 — "수정" 버튼.
function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  )
}

// 단어장 목록 행 "수정" 창 — 오타/잘못 입력한 발음·뜻을 고친다. 단어(lemma)는 모든 단어장이
// 같이 쓰는 마스터 데이터라 여기서는 고치지 못한다(표기 자체가 틀렸으면 삭제 후 다시 추가).
function EditWordModal({ item, busy, error, onSubmit, onClose }) {
  const [reading, setReading] = useState(item.reading ?? '')
  const [meaningsText, setMeaningsText] = useState((item.meanings ?? []).join('\n'))

  function handleSubmit(e) {
    e.preventDefault()
    const meanings = meaningsText.split('\n').map((s) => s.trim()).filter(Boolean)
    onSubmit({ reading: reading.trim(), meanings })
  }

  return (
    <div className="wordbook-modal-backdrop" onClick={onClose}>
      <div className="wordbook-modal wordbook-modal--wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="wordbook-modal-title">단어 수정</h3>
        <p className="wordbook-modal-sub">"{item.lemma}"의 발음·뜻을 고쳐요. 단어 표기 자체가 틀렸다면 삭제 후 다시 추가해주세요.</p>
        <form onSubmit={handleSubmit}>
          <label className="wordbook-add-word-field">
            <span className="wordbook-add-word-label">발음</span>
            <input
              type="text"
              className="wordbook-create-modal-input"
              value={reading}
              onChange={(e) => setReading(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onClose()
              }}
              maxLength={120}
              autoFocus
            />
          </label>
          <label className="wordbook-add-word-field">
            <span className="wordbook-add-word-label">의미 (한 줄에 하나씩)</span>
            <textarea
              className="wordbook-create-modal-input wordbook-add-word-textarea"
              value={meaningsText}
              onChange={(e) => setMeaningsText(e.target.value)}
              rows={3}
              maxLength={300}
            />
          </label>
          {error && <p className="wordbook-create-modal-error">{error}</p>}
          <div className="wordbook-create-modal-actions">
            <button type="button" className="wordbook-modal-close-btn" onClick={onClose}>취소</button>
            <button type="submit" className="wordbook-create-modal-submit" disabled={busy || !reading.trim()}>
              {busy ? '저장하는 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 단어장을 다른 폴더로 옮기는 창 — 사이드바 각 줄의 ⋮ 메뉴 "이동"에서 뜬다.
function WordbookMoveFolderModal({ book, folders, folderId, onFolderChange, busy, error, onSubmit, onClose }) {
  return (
    <div className="wordbook-modal-backdrop" onClick={onClose}>
      <div className="wordbook-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="wordbook-modal-title">단어장 이동</h3>
        <p className="wordbook-modal-sub">"{book.name}"을(를) 옮길 폴더를 골라주세요.</p>
        <FolderSelect folders={folders} value={folderId} onChange={onFolderChange} />
        {error && <p className="wordbook-create-modal-error">{error}</p>}
        <div className="wordbook-create-modal-actions">
          <button type="button" className="wordbook-modal-close-btn" onClick={onClose}>취소</button>
          <button type="button" className="wordbook-create-modal-submit" disabled={busy} onClick={onSubmit}>
            {busy ? '이동 중...' : '이동'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 사이드바에 보여주는 단어장 한 줄 — 폴더에 속했든 아니든 똑같이 이 컴포넌트를 쓴다.
// 이름 오른쪽에 바로 개수가 붙도록(이름에 flex:1을 주지 않고) 해서, 개수가 화면 맨
// 오른쪽까지 밀려나지 않게 한다. 마우스를 올리면 맨 오른쪽에 점 세개(⋮) 메뉴 버튼이
// 나타나고, 거기서 수정/이동/삭제를 고를 수 있다(즐겨찾기 단어장은 뺄 수 없어서 메뉴 없음).
function WordbookSidebarItem({ book, active, onSelect, renaming, renameValue, onRenameChange, onRenameCommit, onRenameCancel, menuOpen, onToggleMenu, onCloseMenu, onStartRename, onStartMove, onDelete, onToggleVisibility }) {
  return (
    <div
      className={`wordbook-sidebar-item${active ? ' wordbook-sidebar-item--active' : ''}`}
      onClick={() => onSelect(book.id)}
    >
      <svg
        className={`wordbook-sidebar-item-chevron${active ? ' wordbook-sidebar-item-chevron--open' : ''}`}
        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
      <span className={`wordbook-sidebar-item-icon${book.favoriteDefault ? ' wordbook-sidebar-item-icon--star' : ''}`}>
        {book.favoriteDefault ? '★' : (book.emoji || '📖')}
      </span>
      {renaming ? (
        <input
          type="text"
          className="wordbook-sidebar-rename-input"
          value={renameValue}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onRenameChange(e.target.value)}
          onBlur={onRenameCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onRenameCommit() }
            if (e.key === 'Escape') onRenameCancel()
          }}
          maxLength={60}
        />
      ) : (
        <span className="wordbook-sidebar-item-name">{book.name}</span>
      )}
      <span className="wordbook-sidebar-item-count">{book.itemCount}개</span>
      <span className="wordbook-sidebar-item-spacer" />
      {!book.favoriteDefault && (
        <span className="wordbook-sidebar-item-menu-wrap" onClick={(e) => e.stopPropagation()}>
          {!book.isPublic && (
            <span className="wordbook-sidebar-item-lock" aria-label="비공개 단어장">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="#FFC53D">
                <path d="M10 1.5a4 4 0 0 0-4 4v2.25H5a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 5 17.75h10a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 15 7.75h-1V5.5a4 4 0 0 0-4-4Zm0 2a2 2 0 0 1 2 2v2.25H8V5.5a2 2 0 0 1 2-2Z" />
              </svg>
            </span>
          )}
          <span
            role="button"
            tabIndex={0}
            className="wordbook-sidebar-item-menu-btn"
            onClick={onToggleMenu}
            aria-label={`${book.name} 메뉴`}
          >
            ⋮
          </span>
          {menuOpen && (
            <>
              <div className="wordbook-sidebar-item-menu-backdrop" onClick={onCloseMenu} />
              <div className="wordbook-sidebar-item-menu-panel">
                <button type="button" onClick={onStartRename}>수정</button>
                <button type="button" onClick={onStartMove}>이동</button>
                <button type="button" onClick={onToggleVisibility}>{book.isPublic ? '비공개로 전환' : '공개 전환'}</button>
                <button type="button" className="wordbook-sidebar-item-menu-option--danger" onClick={(e) => onDelete(e, book)}>삭제</button>
              </div>
            </>
          )}
        </span>
      )}
    </div>
  )
}

// 단어장 화면 — PC 웹 우선 개발이라 화면을 세로로 길게 쓰지 않고, 왼쪽에 단어장
// 목록을 디렉토리처럼 보여주는 사이드바 + 오른쪽 넓은 본문으로 된 가로 레이아웃을 쓴다.
// 목록/상세가 예전엔 별도 라우트(별도 페이지 이동)였지만, 지금은 이 화면 하나에서
// 사이드바로 단어장을 바꿔가며 볼 수 있게 합쳤다 — /wordbook, /wordbook/:id 둘 다
// 이 컴포넌트를 그린다(App.jsx).
// 로그인 필수 — App.jsx의 RequireAuth가 비로그인 접근을 막는다.
export default function Wordbook() {
  const { id: routeId } = useParams()
  const navigate = useNavigate()

  const [books, setBooks] = useState([])
  const [booksLoading, setBooksLoading] = useState(true)
  const [booksError, setBooksError] = useState(null)

  const [selectedId, setSelectedId] = useState(routeId ?? null)

  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState(null)

  const [mode, setMode] = useState('list') // 'list' | 'study'
  const [studyMethod, setStudyMethod] = useState(null) // 'flashcard' | 'quiz' | 'fill' | 'reorder' | 'match'
  const [methodModalOpen, setMethodModalOpen] = useState(false)

  // "+" 버튼을 누르면 폴더/단어장 중 뭘 만들지 고르는 작은 드롭다운이 뜨고,
  // 고른 뒤에 이름(+ 단어장이면 넣을 폴더) 입력 폼이 나온다.
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [createType, setCreateType] = useState(null) // null | 'folder' | 'wordbook'
  const [newName, setNewName] = useState('')
  const [newFolderId, setNewFolderId] = useState('')
  const [savingNew, setSavingNew] = useState(false)
  const [createError, setCreateError] = useState(null)
  const newNameInputRef = useRef(null)
  const renameBookInputRef = useRef(null)

  const [folders, setFolders] = useState([])
  const [collapsedFolderIds, setCollapsedFolderIds] = useState(() => new Set())

  // 단어장 이름 인라인 편집(본문 제목), 폴더 이름 인라인 편집(사이드바).
  const [renamingBook, setRenamingBook] = useState(false)
  const [renameBookValue, setRenameBookValue] = useState('')
  const [renamingFolderId, setRenamingFolderId] = useState(null)
  const [renameFolderValue, setRenameFolderValue] = useState('')

  // 사이드바 각 단어장 줄의 ⋮ 메뉴 — 한 번에 하나만 열려 있고(id로 관리), 거기서
  // 고르는 "수정"은 그 줄 안에서 바로 인라인으로 이름을 바꾸고, "이동"은 폴더 선택 창을 연다.
  const [openRowMenuId, setOpenRowMenuId] = useState(null)
  const [renamingRowId, setRenamingRowId] = useState(null)
  const [renameRowValue, setRenameRowValue] = useState('')
  const [moveBook, setMoveBook] = useState(null)
  const [moveFolderId, setMoveFolderId] = useState('')
  const [moveBusy, setMoveBusy] = useState(false)
  const [moveError, setMoveError] = useState(null)

  // 여러 단어를 한 번에 지우거나 다른 단어장으로 옮기는 "선택하기" 모드.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  // 단어 직접 추가 창 — 단어/발음/의미 입력값 자체는 AddWordModal 내부 상태로 관리한다
  // (창을 열 때마다 새로 마운트되므로 닫았다 다시 열면 자연히 비워짐).
  const [addWordOpen, setAddWordOpen] = useState(false)
  const [addWordBusy, setAddWordBusy] = useState(false)
  const [addWordError, setAddWordError] = useState(null)

  // 단어 수정 창 — 고치는 대상 항목(editingItem)이 있으면 열려있는 것으로 간주한다.
  const [editingItem, setEditingItem] = useState(null)
  const [editWordBusy, setEditWordBusy] = useState(false)
  const [editWordError, setEditWordError] = useState(null)

  function refreshBooks(preferId) {
    setBooksLoading(true)
    setBooksError(null)
    return listWordbooks()
      .then((data) => {
        const list = data ?? []
        setBooks(list)
        // 선택된 단어장이 없거나(최초 진입) 삭제되어 사라졌으면, 지정된 id 또는
        // 첫 번째 단어장(보통 즐겨찾기)을 자동으로 선택한다 — 빈 화면으로 두지 않는다.
        setSelectedId((prev) => {
          const target = preferId ?? prev
          if (target && list.some((b) => String(b.id) === String(target))) return target
          return list[0] ? String(list[0].id) : null
        })
        return list
      })
      .catch((err) => setBooksError(err))
      .finally(() => setBooksLoading(false))
  }

  function refreshFolders() {
    return listWordbookFolders()
      .then((data) => setFolders(data ?? []))
      .catch(() => {
        // 폴더 목록을 못 불러와도 단어장 자체는 볼 수 있어야 하니 조용히 무시.
      })
  }

  useEffect(() => {
    refreshBooks(routeId)
    refreshFolders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function refreshItems(bookId) {
    if (!bookId) {
      setItems([])
      return Promise.resolve()
    }
    setItemsLoading(true)
    setItemsError(null)
    return listWordbookItems(bookId)
      .then((data) => setItems(data ?? []))
      .catch((err) => setItemsError(err))
      .finally(() => setItemsLoading(false))
  }

  useEffect(() => {
    setMode('list')
    setStudyMethod(null)
    setMethodModalOpen(false)
    setSelectMode(false)
    setSelectedIds(new Set())
    setMoveModalOpen(false)
    setRenamingBook(false)
    setOpenRowMenuId(null)
    setRenamingRowId(null)
    if (selectedId) {
      refreshItems(selectedId)
      navigate(`/wordbook/${selectedId}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  function selectBook(id) {
    setSelectedId(String(id))
  }

  async function handleCreateSubmit(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name || savingNew || !createType) return
    setSavingNew(true)
    setCreateError(null)
    try {
      if (createType === 'folder') {
        await createWordbookFolder(name)
        await refreshFolders()
        setNewName('')
        setCreateType(null)
      } else {
        const created = await createWordbook(name, newFolderId ? Number(newFolderId) : null)
        setNewName('')
        setNewFolderId('')
        setCreateType(null)
        await refreshBooks(created?.id ? String(created.id) : undefined)
      }
    } catch (err) {
      // 실패해도 입력값은 남겨서 다시 시도할 수 있게 한다. 창에는 실패했다는 걸 보여준다.
      console.error('단어장/폴더 만들기 실패:', err)
      setCreateError(err?.message || '만들지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setSavingNew(false)
    }
  }

  // "+" 버튼 → 드롭다운에서 폴더/단어장 중 고르면 그에 맞는 이름 입력 폼을 연다.
  // 폴더 목록을 매번 다시 불러와서(방금 다른 곳에서 만든 폴더가 있어도) 최신 상태로 보여준다.
  function openCreate(type) {
    setAddMenuOpen(false)
    setCreateType(type)
    setNewName('')
    setNewFolderId('')
    setCreateError(null)
    refreshFolders()
    setTimeout(() => newNameInputRef.current?.focus(), 0)
  }
  function openAddWord() {
    setAddWordError(null)
    setAddWordOpen(true)
  }
  function closeAddWord() {
    if (addWordBusy) return
    setAddWordOpen(false)
  }
  async function handleAddWordSubmit({ lemma, reading, meanings }) {
    if (!lemma || addWordBusy || !selectedId) return
    setAddWordBusy(true)
    setAddWordError(null)
    try {
      await addCustomWordbookItem({
        lemma, lang: 'JA', wordbookId: Number(selectedId),
        reading: reading || undefined,
        meanings: meanings && meanings.length > 0 ? meanings : undefined,
      })
      setAddWordOpen(false)
      await refreshItems(selectedId)
      refreshBooks(selectedId)
    } catch (err) {
      console.error('단어 직접 추가 실패:', err)
      setAddWordError(err?.message || '추가하지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setAddWordBusy(false)
    }
  }
  function openEditWord(item) {
    setEditWordError(null)
    setEditingItem(item)
  }
  function closeEditWord() {
    if (editWordBusy) return
    setEditingItem(null)
  }
  async function handleEditWordSubmit({ reading, meanings }) {
    if (!editingItem || editWordBusy) return
    setEditWordBusy(true)
    setEditWordError(null)
    try {
      await updateWordbookItemWord(editingItem.id, { reading, meanings })
      setEditingItem(null)
      await refreshItems(selectedId)
    } catch (err) {
      console.error('단어 수정 실패:', err)
      setEditWordError(err?.message || '수정하지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setEditWordBusy(false)
    }
  }
  function cancelCreate() {
    setCreateType(null)
    setNewName('')
    setNewFolderId('')
    setCreateError(null)
  }

  async function handleDeleteBook(e, book) {
    e.stopPropagation()
    if (book.favoriteDefault) return
    if (!window.confirm('단어장을 정말로 삭제할까요?')) return
    try {
      await deleteWordbook(book.id)
      await refreshBooks()
    } catch {
      // 실패하면 목록이 그대로 남는다 — 다시 시도 가능.
    }
  }

  function toggleFolderCollapsed(folderId) {
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  function startRenameFolder(e, folder) {
    e.stopPropagation()
    setRenamingFolderId(folder.id)
    setRenameFolderValue(folder.name)
  }
  async function commitRenameFolder(folderId) {
    const name = renameFolderValue.trim()
    setRenamingFolderId(null)
    if (!name) return
    try {
      await renameWordbookFolder(folderId, name)
      setFolders((prev) => prev.map((f) => (String(f.id) === String(folderId) ? { ...f, name } : f)))
    } catch {
      await refreshFolders()
    }
  }

  async function handleDeleteFolder(e, folder) {
    e.stopPropagation()
    if (!window.confirm('폴더를 정말로 삭제할까요? 안의 단어장은 지워지지 않고 폴더 밖으로 나가요.')) return
    try {
      await deleteWordbookFolder(folder.id)
      await Promise.all([refreshFolders(), refreshBooks()])
    } catch {
      // 실패하면 목록이 그대로 남는다.
    }
  }

  function startRenameBook() {
    if (!selectedBook) return
    setRenamingBook(true)
    setRenameBookValue(selectedBook.name)
    setTimeout(() => renameBookInputRef.current?.focus(), 0)
  }
  async function commitRenameBook() {
    const name = renameBookValue.trim()
    setRenamingBook(false)
    if (!name || !selectedBook || name === selectedBook.name) return
    try {
      await renameWordbook(selectedBook.id, name)
      setBooks((prev) => prev.map((b) => (String(b.id) === String(selectedBook.id) ? { ...b, name } : b)))
    } catch {
      // 실패하면 이름이 그대로 남는다 — 다시 시도 가능.
    }
  }

  // 사이드바 각 줄의 ⋮ 메뉴 — 토글, 수정(인라인 이름 변경), 이동(폴더 선택 창), 삭제.
  function toggleRowMenu(bookId) {
    setOpenRowMenuId((prev) => (prev === bookId ? null : bookId))
  }
  function closeRowMenu() {
    setOpenRowMenuId(null)
  }
  function startRenameRow(book) {
    setOpenRowMenuId(null)
    setRenamingRowId(book.id)
    setRenameRowValue(book.name)
  }
  function cancelRenameRow() {
    setRenamingRowId(null)
  }
  async function commitRenameRow(bookId) {
    const name = renameRowValue.trim()
    const original = books.find((b) => String(b.id) === String(bookId))
    setRenamingRowId(null)
    if (!name || !original || name === original.name) return
    try {
      await renameWordbook(bookId, name)
      setBooks((prev) => prev.map((b) => (String(b.id) === String(bookId) ? { ...b, name } : b)))
    } catch {
      // 실패하면 이름이 그대로 남는다 — 다시 시도 가능.
    }
  }

  function startMoveRow(book) {
    setOpenRowMenuId(null)
    setMoveBook(book)
    setMoveFolderId(book.folderId ? String(book.folderId) : '')
    setMoveError(null)
    refreshFolders()
  }
  function closeMoveModal() {
    setMoveBook(null)
    setMoveError(null)
  }

  // 사이드바 ⋮ 메뉴 "공개 설정" — 비공개↔공개 토글. 즐겨찾기 단어장을 공개로 돌리려 하면
  // 서버가 400 + { message }를 내려주므로(즐겨찾기 단어장은 메뉴 자체가 없어서 실제로는
  // 호출될 일이 없지만) 혹시 모를 경우를 대비해 에러 메시지를 그대로 alert로 보여준다.
  async function toggleVisibilityRow(book) {
    setOpenRowMenuId(null)
    const nextPublic = !book.isPublic
    try {
      await setWordbookVisibility(book.id, nextPublic)
      setBooks((prev) => prev.map((b) => (String(b.id) === String(book.id) ? { ...b, isPublic: nextPublic } : b)))
    } catch (err) {
      alert(err?.message || '공개 설정을 바꾸지 못했어요. 잠시 후 다시 시도해주세요.')
    }
  }
  async function handleMoveSubmit() {
    if (!moveBook || moveBusy) return
    setMoveBusy(true)
    setMoveError(null)
    try {
      await moveWordbookToFolder(moveBook.id, moveFolderId ? Number(moveFolderId) : null)
      setMoveBook(null)
      await refreshBooks()
    } catch (err) {
      console.error('단어장 이동 실패:', err)
      setMoveError(err?.message || '이동하지 못했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setMoveBusy(false)
    }
  }

  async function handleRemoveItem(itemId) {
    // 별표(즐겨찾기)는 같은 단어를 가리키는 별도의 항목 행이라, 어느 쪽에서 지우든 서버가
    // 이 단어의 모든 항목(원래 단어장 + 즐겨찾기)을 함께 지운다 — 즐겨찾기에서 지울 땐 그
    // 사실을 미리 알려준다.
    const confirmMessage = selectedBook?.favoriteDefault
      ? '이 단어를 단어장에서 지울까요?\n확인을 누르면 원래 단어장에서도 삭제됩니다.'
      : '이 단어를 단어장에서 지울까요?'
    if (!window.confirm(confirmMessage)) return
    try {
      await removeWordbookItem(itemId)
      setItems((prev) => prev.filter((it) => it.id !== itemId))
      // 이 단어가 다른 단어장(즐겨찾기 포함)에도 있었다면 거기서도 같이 지워졌으므로,
      // 사이드바 개수도 전체를 다시 불러와서 정확히 맞춘다.
      refreshBooks(selectedId)
    } catch {
      // 실패하면 목록이 그대로 남는다.
    }
  }

  // "선택하기" 모드 — 단어가 많아지면 하나씩 삭제하기 번거로우니, 여러 개를 골라 한 번에
  // 지우거나 다른 단어장으로 옮길 수 있게 한다.
  function toggleSelectMode() {
    setSelectMode((v) => !v)
    setSelectedIds(new Set())
  }
  function toggleSelectItem(itemId) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }
  async function handleBulkDelete() {
    if (selectedIds.size === 0 || bulkBusy) return
    if (!window.confirm(`선택한 단어 ${selectedIds.size}개를 단어장에서 지울까요?`)) return
    setBulkBusy(true)
    const ids = [...selectedIds]
    try {
      await Promise.all(ids.map((id) => removeWordbookItem(id)))
      setItems((prev) => prev.filter((it) => !selectedIds.has(it.id)))
      setBooks((prev) => prev.map((b) => (String(b.id) === String(selectedId) ? { ...b, itemCount: Math.max(0, b.itemCount - ids.length) } : b)))
      setSelectedIds(new Set())
      setSelectMode(false)
    } catch {
      // 일부만 성공했을 수 있으니 실제 서버 상태로 다시 맞춘다.
      await refreshItems(selectedId)
      await refreshBooks(selectedId)
    } finally {
      setBulkBusy(false)
    }
  }
  async function handleMoveSelected(targetBookId) {
    if (selectedIds.size === 0 || bulkBusy) return
    setBulkBusy(true)
    const targets = items.filter((it) => selectedIds.has(it.id))
    try {
      await Promise.all(
        targets.map(async (it) => {
          await addWordbookItem({ lemma: it.lemma, lang: it.lang, wordbookId: targetBookId })
          await removeWordbookItem(it.id)
        })
      )
      setItems((prev) => prev.filter((it) => !selectedIds.has(it.id)))
      setBooks((prev) =>
        prev.map((b) => {
          if (String(b.id) === String(selectedId)) return { ...b, itemCount: Math.max(0, b.itemCount - targets.length) }
          if (String(b.id) === String(targetBookId)) return { ...b, itemCount: b.itemCount + targets.length }
          return b
        })
      )
      setSelectedIds(new Set())
      setSelectMode(false)
      setMoveModalOpen(false)
    } catch {
      await refreshItems(selectedId)
      await refreshBooks(selectedId)
    } finally {
      setBulkBusy(false)
    }
  }

  async function handleToggleStar(itemId) {
    try {
      const updated = await toggleWordbookItemStar(itemId)
      setItems((prev) => prev.map((it) => (it.id === itemId ? updated : it)))
    } catch {
      // 실패해도 무시 — 다시 눌러볼 수 있다.
    }
  }

  // "단어 학습하기" 버튼 — 페이지 전환 없이 학습 방법 선택 창을 띄운다.
  function startStudy() {
    setMethodModalOpen(true)
  }
  function selectStudyMethod(id) {
    setStudyMethod(id)
    setMethodModalOpen(false)
    setMode('study')
  }

  // 플래시카드 게임에서 "안다/모른다"를 눌렀을 때만 서버 SRS 상태를 갱신한다(다른 게임은
  // 정답/오답이 서버 학습 상태에 영향을 주지 않는 연습용 게임).
  async function handleReview(itemId, know) {
    try {
      const updated = await reviewWordbookItem(itemId, know)
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)))
    } catch {
      // 실패해도 게임 진행은 계속한다 — 흐름이 끊기지 않게.
    }
  }

  const selectedBook = books.find((b) => String(b.id) === String(selectedId))

  // 사이드바 단어장 줄 하나가 필요로 하는 공통 props(선택/인라인 이름수정/⋮메뉴)를 한 곳에서 만든다.
  function sidebarItemProps(book) {
    return {
      active: String(book.id) === String(selectedId),
      onSelect: selectBook,
      renaming: renamingRowId === book.id,
      renameValue: renameRowValue,
      onRenameChange: setRenameRowValue,
      onRenameCommit: () => commitRenameRow(book.id),
      onRenameCancel: cancelRenameRow,
      menuOpen: openRowMenuId === book.id,
      onToggleMenu: () => toggleRowMenu(book.id),
      onCloseMenu: closeRowMenu,
      onStartRename: () => startRenameRow(book),
      onStartMove: () => startMoveRow(book),
      onDelete: handleDeleteBook,
      onToggleVisibility: () => toggleVisibilityRow(book),
    }
  }

  return (
    <div className="wordbook-page">
      <TopBar showSearch={false} />

      <div className="wordbook-shell">
        {/* 왼쪽 사이드바 — 단어장을 디렉토리 목록처럼 보여준다 */}
        <aside className="wordbook-sidebar">
          <div className="wordbook-sidebar-header">
            <span className="wordbook-sidebar-title">내 단어장</span>
            <div className="wordbook-sidebar-add-wrap">
              <button
                type="button"
                className="wordbook-sidebar-add-btn"
                onClick={() => setAddMenuOpen((v) => !v)}
                aria-label="새로 만들기"
                title="새로 만들기"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              {addMenuOpen && (
                <>
                  <div className="wordbook-add-menu-backdrop" onClick={() => setAddMenuOpen(false)} />
                  <div className="wordbook-add-menu">
                    <button type="button" onClick={() => openCreate('folder')}>📁 폴더 만들기</button>
                    <button type="button" onClick={() => openCreate('wordbook')}>📖 단어장 만들기</button>
                  </div>
                </>
              )}
            </div>
          </div>

          {booksLoading ? (
            <div className="wordbook-sidebar-status">불러오는 중...</div>
          ) : booksError ? (
            <div className="wordbook-sidebar-status wordbook-sidebar-status--error">불러오지 못했어요.</div>
          ) : (
            <nav className="wordbook-sidebar-list">
              {/* 즐겨찾기는 폴더에 넣을 수 없는 기본 단어장 — 항상 맨 위에 고정해서 보여준다. */}
              {books.filter((b) => b.favoriteDefault).map((book) => (
                <WordbookSidebarItem key={book.id} book={book} {...sidebarItemProps(book)} />
              ))}
              {folders.map((folder) => {
                const folderBooks = books.filter((b) => String(b.folderId) === String(folder.id))
                const collapsed = collapsedFolderIds.has(folder.id)
                return (
                  <div key={folder.id} className="wordbook-sidebar-folder">
                    <div className="wordbook-sidebar-folder-header" onClick={() => toggleFolderCollapsed(folder.id)}>
                      <svg
                        className={`wordbook-sidebar-item-chevron${collapsed ? '' : ' wordbook-sidebar-item-chevron--open'}`}
                        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                      <span className="wordbook-sidebar-item-icon">📁</span>
                      {renamingFolderId === folder.id ? (
                        <input
                          type="text"
                          className="wordbook-sidebar-rename-input"
                          value={renameFolderValue}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setRenameFolderValue(e.target.value)}
                          onBlur={() => commitRenameFolder(folder.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commitRenameFolder(folder.id) }
                            if (e.key === 'Escape') setRenamingFolderId(null)
                          }}
                          maxLength={60}
                        />
                      ) : (
                        <span
                          className="wordbook-sidebar-item-name"
                          onDoubleClick={(e) => startRenameFolder(e, folder)}
                        >
                          {folder.name}
                        </span>
                      )}
                      {/* 폴더 옆 숫자는 폴더 안 단어장 개수가 아니라, 그 안의 모든 단어장에 든 단어 수를 합한 값이어야 한다. */}
                      <span className="wordbook-sidebar-item-count">
                        {folderBooks.reduce((sum, b) => sum + (b.itemCount || 0), 0)}개
                      </span>
                      <span className="wordbook-sidebar-item-spacer" />
                      <span
                        role="button"
                        tabIndex={0}
                        className="wordbook-sidebar-item-delete"
                        onClick={(e) => handleDeleteFolder(e, folder)}
                        aria-label={`${folder.name} 폴더 삭제`}
                      >
                        ×
                      </span>
                    </div>
                    {!collapsed && (
                      <div className="wordbook-sidebar-folder-items">
                        {folderBooks.map((book) => (
                          <WordbookSidebarItem key={book.id} book={book} {...sidebarItemProps(book)} />
                        ))}
                        {folderBooks.length === 0 && (
                          <div className="wordbook-sidebar-folder-empty">비어 있어요</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {books.filter((b) => !b.folderId && !b.favoriteDefault).map((book) => (
                <WordbookSidebarItem key={book.id} book={book} {...sidebarItemProps(book)} />
              ))}
            </nav>
          )}

          {/* 다른 사람이 공개한 단어장을 구경하는 게시판(Phase 2, 구현 완료). */}
          <button
            type="button"
            className="wordbook-sidebar-browse-btn"
            onClick={() => navigate('/board')}
          >
            단어장 둘러보기
          </button>
        </aside>

        {/* 오른쪽 본문 — 화면을 가로로 넓게 쓴다(PC web 우선) */}
        <main className="wordbook-main">
          {!selectedBook ? (
            <div className="wordbook-main-status">
              왼쪽에서 단어장을 선택하거나 새로 만들어보세요.
            </div>
          ) : (
            <>
              <div className="wordbook-main-header">
                {renamingBook ? (
                  <input
                    ref={renameBookInputRef}
                    type="text"
                    className="wordbook-main-title-input"
                    value={renameBookValue}
                    onChange={(e) => setRenameBookValue(e.target.value)}
                    onBlur={commitRenameBook}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitRenameBook() }
                      if (e.key === 'Escape') setRenamingBook(false)
                    }}
                    maxLength={60}
                  />
                ) : (
                  <h1 className="wordbook-main-title">
                    {selectedBook.favoriteDefault && <span className="wordbook-card-star">★ </span>}
                    {selectedBook.name}
                    {!selectedBook.favoriteDefault && (
                      <button
                        type="button"
                        className="wordbook-main-title-edit-btn"
                        onClick={startRenameBook}
                        aria-label="단어장 이름 편집"
                        title="이름 편집"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                    )}
                  </h1>
                )}
                {mode === 'list' && (
                  <div className="wordbook-main-header-actions">
                    {/* 즐겨찾기는 단어장에 담긴 단어 중 별표 누른 것만 모이는 뷰라 선택/직접 추가가 의미 없다 */}
                    {items.length > 0 && !selectedBook.favoriteDefault && (
                      <button
                        type="button"
                        className={`wordbook-select-toggle-btn${selectMode ? ' wordbook-select-toggle-btn--active' : ''}`}
                        onClick={toggleSelectMode}
                      >
                        {selectMode ? '선택 취소' : '선택하기'}
                      </button>
                    )}
                    {!selectedBook.favoriteDefault && (
                      <button type="button" className="wordbook-add-word-btn" onClick={openAddWord}>
                        + 단어 추가
                      </button>
                    )}
                    {items.length > 0 && (
                      <button type="button" className="wordbook-detail-study-btn" onClick={startStudy}>
                        학습하기
                      </button>
                    )}
                  </div>
                )}
                {mode === 'study' && (
                  <button type="button" className="wordbook-main-back-btn" onClick={() => setMode('list')}>
                    목록으로
                  </button>
                )}
              </div>

              {itemsLoading ? (
                <div className="wordbook-main-status">불러오는 중...</div>
              ) : itemsError ? (
                <div className="wordbook-main-status wordbook-main-status--error">단어를 불러오지 못했어요.</div>
              ) : mode === 'list' ? (
                items.length === 0 ? (
                  <div className="wordbook-main-status">
                    아직 담긴 단어가 없어요. 위의 "+ 단어 추가"로 직접 넣거나, 곡 학습 화면에서 단어장 아이콘 버튼으로 추가해보세요.
                  </div>
                ) : (
                  <>
                    <div className="wordbook-detail-grid">
                      {items.map((item) => (
                        <div
                          className={`wordbook-detail-row${selectMode ? ' wordbook-detail-row--selectable' : ''}`}
                          key={item.id}
                          onClick={selectMode ? () => toggleSelectItem(item.id) : undefined}
                        >
                          {selectMode ? (
                            <input
                              type="checkbox"
                              className="wordbook-detail-checkbox"
                              checked={selectedIds.has(item.id)}
                              onChange={() => toggleSelectItem(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`${item.lemma} 선택`}
                            />
                          ) : (
                            <button
                              type="button"
                              className={`wordbook-detail-star${item.starred ? ' wordbook-detail-star--on' : ''}`}
                              onClick={() => handleToggleStar(item.id)}
                              aria-label={item.starred ? '즐겨찾기 해제' : '즐겨찾기'}
                            >
                              {item.starred ? '★' : '☆'}
                            </button>
                          )}
                          <div className="wordbook-detail-row-main">
                            <span className="wordbook-detail-row-word">
                              {item.lemma}
                              {item.reading && <span className="wordbook-detail-row-reading">{item.reading}</span>}
                            </span>
                            <span className="wordbook-detail-row-meaning">
                              {item.meanings && item.meanings.length > 0 ? item.meanings.join(', ') : '뜻 준비 중'}
                            </span>
                          </div>
                          <span className={`wordbook-detail-badge ${repetitionTierClass(item.repetitionCount)}`}>
                            {`학습 ${item.repetitionCount}회`}
                          </span>
                          {!selectMode && (
                            <button
                              type="button"
                              className="wordbook-detail-edit"
                              onClick={() => openEditWord(item)}
                              aria-label="발음·뜻 수정"
                              title="발음·뜻 수정"
                            >
                              <PencilIcon />
                            </button>
                          )}
                          {!selectMode && (
                            <button
                              type="button"
                              className="wordbook-detail-remove"
                              onClick={() => handleRemoveItem(item.id)}
                              aria-label="단어장에서 삭제"
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {selectMode && (
                      <div className="wordbook-select-bar">
                        <div className="wordbook-select-bar-actions">
                          <span className="wordbook-select-bar-count">{selectedIds.size}개 선택됨</span>
                          <button
                            type="button"
                            className="wordbook-select-bar-btn wordbook-select-bar-btn--move"
                            disabled={bulkBusy || selectedIds.size === 0}
                            onClick={() => setMoveModalOpen(true)}
                          >
                            이동
                          </button>
                          <button
                            type="button"
                            className="wordbook-select-bar-btn wordbook-select-bar-btn--delete"
                            disabled={bulkBusy || selectedIds.size === 0}
                            onClick={handleBulkDelete}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )
              ) : (
                <StudySession
                  items={items}
                  method={studyMethod}
                  onReview={handleReview}
                  onBack={() => setMethodModalOpen(true)}
                  onExit={() => setMode('list')}
                />
              )}
            </>
          )}
        </main>
      </div>

      {methodModalOpen && (
        <StudyMethodModal onSelect={selectStudyMethod} onClose={() => setMethodModalOpen(false)} />
      )}

      {moveModalOpen && (
        <WordbookMoveModal
          books={books}
          currentId={selectedId}
          busy={bulkBusy}
          onMove={handleMoveSelected}
          onClose={() => setMoveModalOpen(false)}
        />
      )}

      {addWordOpen && (
        <AddWordModal
          key={selectedId}
          bookName={books.find((b) => String(b.id) === String(selectedId))?.name ?? ''}
          busy={addWordBusy}
          error={addWordError}
          onSubmit={handleAddWordSubmit}
          onClose={closeAddWord}
        />
      )}

      {editingItem && (
        <EditWordModal
          item={editingItem}
          busy={editWordBusy}
          error={editWordError}
          onSubmit={handleEditWordSubmit}
          onClose={closeEditWord}
        />
      )}

      {createType && (
        <WordbookCreateModal
          type={createType}
          name={newName}
          onNameChange={setNewName}
          folders={folders}
          folderId={newFolderId}
          onFolderChange={setNewFolderId}
          busy={savingNew}
          error={createError}
          onSubmit={handleCreateSubmit}
          onClose={cancelCreate}
          inputRef={newNameInputRef}
        />
      )}

      {moveBook && (
        <WordbookMoveFolderModal
          book={moveBook}
          folders={folders}
          folderId={moveFolderId}
          onFolderChange={setMoveFolderId}
          busy={moveBusy}
          error={moveError}
          onSubmit={handleMoveSubmit}
          onClose={closeMoveModal}
        />
      )}
    </div>
  )
}
