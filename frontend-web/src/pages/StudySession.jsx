import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ConfirmModal from '../components/ConfirmModal'
import './StudySession.css'

// 단어장 "단어 학습하기" — StudyMethodModal에서 학습 방법을 고르면 그 방식으로 items를
// 학습한다. 플래시카드/퀴즈/빈칸채우기/문장재배열/카드맞추기 5가지. items는 이미 로드된
// WordbookItemResponse 배열(exampleText/exampleStart/exampleEnd/exampleWordSpans 포함)을
// 그대로 받는다. method는 부모(Wordbook.jsx)가 모달 선택 결과로 정해서 내려준다 — 이
// 컴포넌트는 방법 선택 UI를 갖지 않는다(onBack이 눌리면 부모가 다시 그 모달을 띄운다).
//
// onReview(itemId, know): 플래시카드에서 "안다/모른다"를 눌렀을 때만 서버에 SRS 진행을
// 반영한다 — 나머지 게임은 정답/오답 자체가 서버 학습 상태를 바꾸지 않는다(재미 위주 연습).
//
// 객관식 게임(퀴즈/빈칸채우기) 공통 규칙: 오답을 고르면 바로 정답을 알려주지 않는다.
// 고른 오답만 빨갛게 흔들리고, 다시 고를 수 있다 — 정답을 맞출 때까지 반복. 정답을 맞추면
// 그제서야 초록색으로 표시하고 "다음"이 나타난다.
//
// 발음(히라가나 등)은 "힌트" 버튼을 눌러야 보이게 한다 — 언어에 상관없이 item.reading 값을
// 그대로 쓰므로, 나중에 다른 언어(한국어 학습자에게 가타카나 발음 등)에도 그대로 적용된다.

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function sample(arr, n) {
  return shuffle(arr).slice(0, n)
}
function firstMeaning(item) {
  return item.meanings && item.meanings.length > 0 ? item.meanings[0] : null
}
function surfaceOf(item) {
  return item.exampleText.slice(item.exampleStart, item.exampleEnd)
}
// 예문 원문을 "단어 단위" 조각으로 쪼갠다 — spans(그 소절의 단어 구간들) 사이사이 빈틈은
// 조사/어미 등으로 보고 하나의 조각으로 묶는다. 이어붙이면 원문과 정확히 같아야 하므로
// 빈 문자열만 걸러낸다.
function segmentExample(text, spans) {
  if (!spans || spans.length === 0) return [text]
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  const segments = []
  let cursor = 0
  for (const span of sorted) {
    if (span.start > cursor) segments.push(text.slice(cursor, span.start))
    if (span.end > cursor) {
      segments.push(text.slice(Math.max(span.start, cursor), span.end))
      cursor = span.end
    }
  }
  if (cursor < text.length) segments.push(text.slice(cursor))
  return segments.filter((s) => s.length > 0)
}
// AI가 만든 예문은 영어 단어 사이 띄어쓰기(예: "Stage 4")처럼 공백 하나짜리 토큰이 그대로
// 단어 조각으로 들어올 수 있다 — 그걸 그대로 타일로 만들면 빈칸처럼 보이는 버튼이 생긴다.
// 공백뿐인 조각은 따로 고를 필요가 없으니 이웃 조각에 붙여서 없앤다(이어붙인 결과는 그대로).
function mergeWhitespaceSegments(segments) {
  const merged = []
  for (const seg of segments) {
    if (seg.trim() === '') {
      if (merged.length > 0) merged[merged.length - 1] += seg
      else merged.push(seg)
    } else {
      merged.push(seg)
    }
  }
  if (merged.length > 1 && merged[0].trim() === '') {
    merged[1] = merged[0] + merged[1]
    merged.shift()
  }
  return merged
}

export default function StudySession({ items, method, onReview, onBack, onExit }) {
  if (method === 'flashcard') return <FlashcardGame items={items} onReview={onReview} onBack={onBack} onExit={onExit} />
  if (method === 'quiz') return <QuizGame items={items} onReview={onReview} onBack={onBack} onExit={onExit} />
  if (method === 'fill') return <FillBlankGame items={items} onReview={onReview} onBack={onBack} onExit={onExit} />
  if (method === 'reorder') return <ReorderGame items={items} onReview={onReview} onBack={onBack} onExit={onExit} />
  if (method === 'match') return <MatchGame items={items} onReview={onReview} onBack={onBack} onExit={onExit} />
  return null
}

// 학습 방법 선택은 별도 창(StudyMethodModal)에서 하므로, 여기는 제목/진행도만 보여준다 —
// "메뉴로"/"목록으로" 버튼은 화면 오른쪽 위에 이미 있는 "목록으로"와 중복이라 없앴다.
function GameHeader({ title, progress }) {
  return (
    <div className="study-game-header">
      <span className="study-game-title">{title}</span>
      {progress && <span className="study-game-progress">{progress}</span>}
    </div>
  )
}

function DoneScreen({ text, onBack, onExit }) {
  return (
    <div className="wordbook-study-content">
      <div className="wordbook-study-done">
        <span className="wordbook-study-done-emoji">🎉</span>
        <p className="wordbook-study-done-text">{text}</p>
        <div className="study-done-actions">
          <button type="button" className="wordbook-detail-study-btn" onClick={onBack}>다른 방법으로</button>
          <button type="button" className="wordbook-main-back-btn" onClick={onExit}>목록으로</button>
        </div>
      </div>
    </div>
  )
}

// 발음(히라가나 등)을 바로 보여주지 않고, 눌러야 보이는 힌트 버튼. reading이 없으면 아무것도
// 렌더링하지 않는다. 언어와 무관하게 item.reading 값 하나만 쓰므로 다른 언어에도 그대로 쓴다.
function ReadingHint({ reading, revealed, onReveal, className }) {
  if (!reading) return null
  if (revealed) return <span className={className}>{reading}</span>
  return (
    <button type="button" className="study-hint-btn" onClick={onReveal}>
      발음 보기
    </button>
  )
}

// ---------- 1. 플래시카드 ----------
function FlashcardGame({ items, onReview, onBack, onExit }) {
  // "처음부터"를 누르면 이 단어장의 전체 단어로 되돌아가야 하므로, 진입 시점의 전체 목록을
  // 별도로 기억해둔다 — deck(지금 도는 회차)과는 다르다(deck은 "오답만"일 때 부분집합이 됨).
  const [allItems] = useState(items)
  const [deck, setDeck] = useState(items)
  // 이번 회차에서 "공부할게요"(모른다)를 누른 단어 id 모음 — "오답만" 다시 풀기에 쓴다.
  const [wrongIds, setWrongIds] = useState(() => new Set())

  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [showReading, setShowReading] = useState(false)
  const done = index >= deck.length
  const card = !done ? deck[index] : null

  // 네이티브 confirm() 대신 공용 확인 창(ConfirmModal)을 띄운다(2026-10-07 피드백).
  // 여기서는 "아니요/네"가 abort가 아니라 둘 다 다시 시작은 하되 섞을지만 가른다 —
  // shuffleSource가 세팅된 동안 창이 열려있고, 어느 버튼을 눌러도 applyRestart가 불린다.
  const [shuffleSource, setShuffleSource] = useState(null)

  async function handleAnswer(know) {
    if (!card) return
    if (!know) setWrongIds((prev) => new Set(prev).add(card.id))
    await onReview(card.id, know)
    setRevealed(false)
    setShowReading(false)
    setIndex((i) => i + 1)
  }

  function restart(sourceItems) {
    setShuffleSource(sourceItems)
  }
  function applyRestart(shouldShuffle) {
    const sourceItems = shuffleSource
    if (!sourceItems) return
    setDeck(shouldShuffle ? shuffle(sourceItems) : sourceItems)
    setWrongIds(new Set())
    setIndex(0)
    setRevealed(false)
    setShowReading(false)
    setShuffleSource(null)
  }
  function restartAll() {
    restart(allItems)
  }
  function restartWrongOnly() {
    if (wrongIds.size === 0) return
    restart(allItems.filter((it) => wrongIds.has(it.id)))
  }

  if (items.length === 0) return <EmptyState text="학습할 단어가 없어요." onBack={onBack} onExit={onExit} />

  if (done) {
    return (
      <div className="wordbook-study-content">
        <div className="wordbook-study-done">
          <span className="wordbook-study-done-emoji">🎉</span>
          <p className="wordbook-study-done-text">{`${deck.length}개 단어 학습을 끝냈어요!`}</p>
          <div className="study-done-actions">
            <button type="button" className="wordbook-main-back-btn" onClick={restartAll}>처음부터</button>
            <button
              type="button"
              className="wordbook-main-back-btn"
              onClick={restartWrongOnly}
              disabled={wrongIds.size === 0}
              title={wrongIds.size === 0 ? '이번 회차에 "공부할게요"를 누른 단어가 없어요.' : undefined}
            >
              오답만 {wrongIds.size > 0 ? `(${wrongIds.size})` : ''}
            </button>
            <button type="button" className="wordbook-detail-study-btn" onClick={onExit}>끝낼래요</button>
          </div>
        </div>

        {shuffleSource && (
          <ConfirmModal
            title="순서를 섞을까요?"
            cancelLabel="아니요"
            confirmLabel="네, 섞을게요"
            onConfirm={() => applyRestart(true)}
            onCancel={() => applyRestart(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="wordbook-study-content">
      <GameHeader title="플래시카드" progress={`${index + 1} / ${deck.length}`} />
      <div className="wordbook-study-card" onClick={() => setRevealed(true)}>
        <span className="wordbook-study-card-word">{card.lemma}</span>
        <ReadingHint
          reading={card.reading}
          revealed={showReading}
          onReveal={(e) => {
            e.stopPropagation()
            setShowReading(true)
          }}
          className="wordbook-study-card-reading"
        />
        {revealed ? (
          <span className="wordbook-study-card-meaning">{firstMeaning(card) ?? '뜻 준비 중'}</span>
        ) : (
          <span className="wordbook-study-card-hint">탭해서 뜻 보기</span>
        )}
      </div>
      <div className="wordbook-study-actions">
        <button type="button" className="wordbook-study-btn wordbook-study-btn--no" onClick={() => handleAnswer(false)}>공부할게요</button>
        <button type="button" className="wordbook-study-btn wordbook-study-btn--yes" onClick={() => handleAnswer(true)}>알고있어요</button>
      </div>
    </div>
  )
}

// ---------- 2. 의미 맞추기 퀴즈 ----------
function QuizGame({ items, onReview, onBack, onExit }) {
  // 정답을 맞출 때마다 onReview가 부모의 items를 갱신하는데(학습횟수 반영), 그 새 배열을
  // 그대로 dependency로 쓰면 문제 목록/보기가 한창 풀이 중에 다시 섞여버린다 — 그래서 이
  // 게임에 처음 들어올 때의 items를 스냅샷으로 고정해두고, 그 이후 부모 갱신은 무시한다.
  const [frozenItems] = useState(items)
  const pool = useMemo(() => frozenItems.filter((it) => firstMeaning(it)), [frozenItems])
  const questions = useMemo(() => {
    if (pool.length < 2) return []
    return shuffle(pool).map((item) => {
      const distractorPool = pool.filter((it) => it.id !== item.id)
      const distractors = sample(distractorPool, Math.min(3, distractorPool.length)).map((it) => firstMeaning(it))
      const choices = shuffle([firstMeaning(item), ...distractors])
      return { item, choices }
    })
  }, [pool])

  const [index, setIndex] = useState(0)
  const [solved, setSolved] = useState(false)
  const [wrongChoice, setWrongChoice] = useState(null)
  const [shakeKey, setShakeKey] = useState(0)
  const [showReading, setShowReading] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const done = index >= questions.length

  if (pool.length < 2) return <EmptyState text="퀴즈를 만들기엔 뜻이 있는 단어가 너무 적어요(2개 이상 필요)." onBack={onBack} onExit={onExit} />
  if (done) return <DoneScreen text={`${questions.length}문제 중 ${correctCount}개 맞췄어요!`} onBack={onBack} onExit={onExit} />

  const q = questions[index]
  const correctAnswer = firstMeaning(q.item)

  function pick(choice) {
    if (solved) return
    if (choice === correctAnswer) {
      setSolved(true)
      setWrongChoice(null)
      setCorrectCount((c) => c + 1)
      onReview?.(q.item.id, true)
    } else {
      setWrongChoice(choice)
      setShakeKey((k) => k + 1)
    }
  }
  function next() {
    setSolved(false)
    setWrongChoice(null)
    setShowReading(false)
    setIndex((i) => i + 1)
  }

  return (
    <div className="wordbook-study-content">
      <GameHeader title="의미 맞추기 퀴즈" progress={`${index + 1} / ${questions.length}`} />
      <div className="study-quiz-prompt">
        <span className="study-quiz-word">{q.item.lemma}</span>
        <ReadingHint
          reading={q.item.reading}
          revealed={showReading}
          onReveal={() => setShowReading(true)}
          className="study-quiz-reading"
        />
      </div>
      <div className="study-quiz-choices">
        {q.choices.map((choice) => {
          const isCorrectRevealed = solved && choice === correctAnswer
          const isWrongNow = choice === wrongChoice
          const cls = isCorrectRevealed
            ? 'study-choice study-choice--correct'
            : isWrongNow
              ? 'study-choice study-choice--wrong study-choice--shake'
              : 'study-choice'
          return (
            <button
              type="button"
              key={isWrongNow ? `${choice}-${shakeKey}` : choice}
              className={cls}
              onClick={() => pick(choice)}
              disabled={solved}
            >
              {choice}
            </button>
          )
        })}
      </div>
      {solved && (
        <button type="button" className="wordbook-detail-study-btn study-next-btn" onClick={next}>다음</button>
      )}
    </div>
  )
}

// ---------- 3. 빈칸 채우기 ----------
function FillBlankGame({ items, onReview, onBack, onExit }) {
  // QuizGame과 같은 이유로 items를 진입 시점에 고정한다 — 정답을 맞춰 onReview가 부모
  // 상태를 갱신해도 문제/보기가 도중에 다시 계산되지 않는다.
  const [frozenItems] = useState(items)
  const pool = useMemo(
    () => frozenItems.filter((it) => it.exampleText != null && it.exampleStart != null && it.exampleEnd != null),
    [frozenItems]
  )
  const questions = useMemo(() => {
    if (pool.length < 2) return []
    return shuffle(pool).map((item) => {
      const distractorPool = pool.filter((it) => it.id !== item.id)
      // 단어장 안의 다른 단어뿐 아니라, 발음이 헷갈리는 단어장 밖 단어(similarLemmas)도
      // 오답 후보에 섞어서 더 폭넓게 연습할 수 있도록 한다.
      const candidates = [...new Set([...distractorPool.map(surfaceOf), ...(item.similarLemmas ?? [])])]
        .filter((c) => c !== surfaceOf(item))
      const distractors = sample(candidates, Math.min(3, candidates.length))
      const choices = shuffle([...new Set([surfaceOf(item), ...distractors])])
      return { item, choices }
    })
  }, [pool])

  const [index, setIndex] = useState(0)
  const [solved, setSolved] = useState(false)
  const [wrongChoice, setWrongChoice] = useState(null)
  const [shakeKey, setShakeKey] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const done = index >= questions.length

  if (pool.length < 2) {
    return <EmptyState text="빈칸 채우기를 하려면 실제 가사에 등장한 단어가 2개 이상 있어야 해요. 아직 그런 단어가 부족해요." onBack={onBack} onExit={onExit} />
  }
  if (done) return <DoneScreen text={`${questions.length}문제 중 ${correctCount}개 맞췄어요!`} onBack={onBack} onExit={onExit} />

  const q = questions[index]
  const { item } = q
  const answer = surfaceOf(item)
  const before = item.exampleText.slice(0, item.exampleStart)
  const after = item.exampleText.slice(item.exampleEnd)

  function pick(choice) {
    if (solved) return
    if (choice === answer) {
      setSolved(true)
      setWrongChoice(null)
      setCorrectCount((c) => c + 1)
      onReview?.(item.id, true)
    } else {
      setWrongChoice(choice)
      setShakeKey((k) => k + 1)
    }
  }
  function next() {
    setSolved(false)
    setWrongChoice(null)
    setIndex((i) => i + 1)
  }
  // 정답 화면에 보여줄 단어 뜻 — 예문에 등장한 모든 단어(백엔드가 사전에 매칭해서 내려준
  // 것)가 있으면 그걸 다 보여주고, 없으면(옛 캐시 등) 최소한 스터디 중인 단어만이라도 보여준다.
  const explainWords = item.exampleWords && item.exampleWords.length > 0
    ? item.exampleWords
    : firstMeaning(item)
      ? [{ lemma: item.lemma, reading: item.reading, meanings: item.meanings }]
      : []

  return (
    <div className="wordbook-study-content">
      <GameHeader title="빈칸 채우기" progress={`${index + 1} / ${questions.length}`} />
      <div className="study-fill-sentence">
        {before}
        <span className={`study-fill-blank${solved ? ' study-fill-blank--revealed' : ''}`}>
          {solved ? answer : '　　　'}
        </span>
        {after}
      </div>
      <div className="study-quiz-choices">
        {q.choices.map((choice) => {
          const isCorrectRevealed = solved && choice === answer
          const isWrongNow = choice === wrongChoice
          const cls = isCorrectRevealed
            ? 'study-choice study-choice--correct'
            : isWrongNow
              ? 'study-choice study-choice--wrong study-choice--shake'
              : 'study-choice'
          return (
            <button
              type="button"
              key={isWrongNow ? `${choice}-${shakeKey}` : choice}
              className={cls}
              onClick={() => pick(choice)}
              disabled={solved}
            >
              {choice}
            </button>
          )
        })}
      </div>
      {solved && (
        <div className="study-fill-explain">
          {item.exampleTranslation && (
            <p className="study-fill-explain-line">{item.exampleTranslation}</p>
          )}
          {explainWords.map((w, i) => (
            <p
              key={`${w.lemma}-${i}`}
              className={`study-fill-explain-word${w.lemma === item.lemma ? ' study-fill-explain-word--target' : ''}`}
            >
              <span className="study-fill-explain-word-lemma">{w.lemma}</span>
              <span className="study-fill-explain-word-meaning">
                {w.meanings && w.meanings.length > 0 ? w.meanings.join(', ') : '뜻 준비 중'}
              </span>
            </p>
          ))}
        </div>
      )}
      {solved && (
        <button type="button" className="wordbook-detail-study-btn study-next-btn" onClick={next}>다음</button>
      )}
    </div>
  )
}

// ---------- 4. 문장 배열하기 ----------
function ReorderGame({ items, onReview, onBack, onExit }) {
  // 같은 이유로 items를 진입 시점에 고정 — 정답을 맞춰 onReview가 부모 상태를 갱신해도
  // 순서/타일 구성이 도중에 바뀌지 않는다.
  const [frozenItems] = useState(items)
  const pool = useMemo(
    () => frozenItems.filter((it) => it.exampleText && it.exampleWordSpans && it.exampleWordSpans.length > 0),
    [frozenItems]
  )
  const order = useMemo(() => shuffle(pool), [pool])

  const [index, setIndex] = useState(0)
  // segments: 이번 문제의 타일 전체를, 한 번 섞인 뒤로는 자리(순서)가 안 바뀌는 "고정 목록"
  // 으로 둔다 — 보기 칸에서는 이 목록을 항상 그대로(순서 그대로) 그리고, 이미 답안 칸에
  // 들어간 타일만 자리는 유지한 채 안 보이게(placeholder) 만든다. 그래야 타일 하나를
  // 답안 칸으로 옮겨도 "남은 보기들이 가운데로 계속 쏠려 모이는" 일 없이, 나머지 타일들이
  // 처음 그 자리에 그대로 있는다.
  const [segments, setSegments] = useState(null) // [{text,key}]
  // pickedKeys: 답안 칸에 들어간 순서 그대로의 key 목록 — 실제 보여줄 내용은 segments에서 찾는다.
  const [pickedKeys, setPickedKeys] = useState([])
  // null(아직 확인 안 함) | 'correct' | 'wrong' — 정답 확인 결과. 정답이면 "확인" 버튼이
  // "다음"으로 바뀌어서, 이펙트를 다 보고 나서 직접 다음 문제로 넘어갈 수 있다.
  const [checked, setChecked] = useState(null)
  const [solvedCount, setSolvedCount] = useState(0)
  const done = index >= order.length

  const current = !done ? order[index] : null
  const pickedKeySet = useMemo(() => new Set(pickedKeys), [pickedKeys])
  const pickedTiles = useMemo(
    () => (segments ? pickedKeys.map((k) => segments.find((s) => s.key === k)).filter(Boolean) : []),
    [segments, pickedKeys]
  )
  const allPlaced = !!segments && pickedKeys.length === segments.length

  // ---- 드래그로 타일 옮기기/순서 바꾸기 ----
  // 클릭으로도 넣을 수 있지만, 드래그로도 정답 칸에 넣거나 정답 칸 안에서 순서를 바꿀 수
  // 있게 한다. 네이티브 HTML5 드래그 API는 드래그 중에 원본 DOM 노드를 다른 부모로 옮기면
  // (React가 pool→picked처럼 다른 리스트로 재배치할 때 실제로 그렇게 된다) 드래그가
  // 취소돼버리는 문제가 있어서, 포인터 이벤트로 직접 구현한다 — 커서를 따라다니는 "고스트"
  // 타일을 보여주고, 실제 배열은 포인터 위치에 따라 실시간으로 재정렬한다. 실제 이동은
  // 아래 FLIP 이펙트가 맡아서, "팟" 하고 튀지 않고 부드럽게 슬라이드하도록 애니메이션을 건다.
  const assembledRef = useRef(null)
  const poolRef = useRef(null)
  const dragInfoRef = useRef(null) // { x, y, moved }
  const [dragKey, setDragKey] = useState(null)
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 })

  function findTileText(key) {
    const t = segments?.find((s) => s.key === key)
    return t ? t.text : ''
  }

  function isPointInRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  }

  // 컨테이너 안 타일들을 순서대로 보면서, 포인터가 어느 타일 "앞"에 와 있는지 찾는다 —
  // 같은 줄이면 가로 중간 지점, 줄이 바뀌면 그 줄의 시작 지점을 기준으로 삼는다.
  function getDropIndex(containerEl, clientX, clientY, excludeKey) {
    const children = Array.from(containerEl.querySelectorAll('[data-tile-key]')).filter(
      (el) => el.getAttribute('data-tile-key') !== excludeKey
    )
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect()
      const sameRow = clientY >= rect.top && clientY <= rect.bottom
      if (sameRow) {
        if (clientX < rect.left + rect.width / 2) return i
      } else if (clientY < rect.top) {
        return i
      }
    }
    return children.length
  }

  function moveDraggedToPicked(index) {
    setPickedKeys((prev) => {
      const withoutDragged = prev.filter((k) => k !== dragKey)
      const clamped = Math.max(0, Math.min(index, withoutDragged.length))
      const next = [...withoutDragged.slice(0, clamped), dragKey, ...withoutDragged.slice(clamped)]
      if (next.length === prev.length && next.every((k, i) => k === prev[i])) return prev
      return next
    })
  }
  function moveDraggedToPool() {
    setPickedKeys((prev) => (prev.includes(dragKey) ? prev.filter((k) => k !== dragKey) : prev))
  }

  function handlePointerDown(e, tile) {
    if (checked === 'correct') return
    e.preventDefault()
    setChecked(null)
    dragInfoRef.current = { x: e.clientX, y: e.clientY, moved: false }
    setDragKey(tile.key)
    setGhostPos({ x: e.clientX, y: e.clientY })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!dragKey) return
    function handleMove(e) {
      const x = e.clientX
      const y = e.clientY
      setGhostPos({ x, y })
      if (dragInfoRef.current && !dragInfoRef.current.moved) {
        const dx = x - dragInfoRef.current.x
        const dy = y - dragInfoRef.current.y
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          dragInfoRef.current.moved = true
          // 진짜 "드래그"로 확정되는 순간 — 보기 칸에 있던 옛 위치를 기준으로 답안 칸까지
          // 날아오는 슬라이드 애니메이션이 걸리지 않도록 그 기록을 지운다. 드래그 중에는
          // 커서를 따라다니는 고스트가 이미 "옮겨가는 중"을 보여주고 있으므로, 실제 타일은
          // 답안 칸에 그냥 나타나면 된다(클릭으로 넣을 때는 이 기록이 남아있어서 계속
          // 부드럽게 슬라이드해 들어간다).
          delete prevRectsRef.current[dragKey]
        }
      }
      const assembledEl = assembledRef.current
      const poolEl = poolRef.current
      if (assembledEl && isPointInRect(x, y, assembledEl.getBoundingClientRect())) {
        moveDraggedToPicked(getDropIndex(assembledEl, x, y, dragKey))
      } else if (poolEl && isPointInRect(x, y, poolEl.getBoundingClientRect())) {
        moveDraggedToPool()
      }
    }
    function handleUp() {
      const moved = dragInfoRef.current?.moved
      if (!moved) {
        // 거의 움직이지 않았으면 드래그가 아니라 "탭/클릭"으로 취급 — 반대쪽 칸으로 토글.
        const key = dragKey
        setPickedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
      }
      dragInfoRef.current = null
      setDragKey(null)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [dragKey])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!current) return
    const segs = mergeWhitespaceSegments(segmentExample(current.exampleText, current.exampleWordSpans))
      .map((text, i) => ({ text, key: `${i}` }))
    setSegments(shuffle(segs))
    setPickedKeys([])
    setChecked(null)
  }, [index])

  // ---- 타일이 "팟" 튀지 않고 부드럽게 슬라이드하도록 하는 FLIP 애니메이션 ----
  // 보기 칸(pool)에서 타일 하나가 답안 칸(assembled)으로 들어가거나, 답안 칸 안에서 순서가
  // 바뀌거나, 다시 보기 칸으로 돌아올 때 — 렌더링 전/후의 실제 화면 위치를 비교해서, 위치가
  // 바뀐 타일만 "바뀌기 전 위치 → transform 되돌리기" 방식(FLIP)으로 이동을 애니메이션한다.
  // 보기 칸의 타일들은 항상 같은 자리에 그대로 있으므로(아래 렌더링 참고) 원래 자기 위치가
  // 안 바뀌는 한 애니메이션 대상이 되지 않는다 — 그래서 "남은 단어는 가만히" 요구도 같이
  // 만족된다.
  const prevRectsRef = useRef({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const prevRects = prevRectsRef.current
    const newRects = {}
    function animateContainer(containerEl, isVisibleFn) {
      if (!containerEl) return
      containerEl.querySelectorAll('[data-tile-key]').forEach((el) => {
        const key = el.getAttribute('data-tile-key')
        if (!isVisibleFn(key)) return
        const rect = el.getBoundingClientRect()
        newRects[key] = rect
        const prev = prevRects[key]
        if (prev && (Math.round(prev.left) !== Math.round(rect.left) || Math.round(prev.top) !== Math.round(rect.top))) {
          const dx = prev.left - rect.left
          const dy = prev.top - rect.top
          el.style.transition = 'none'
          el.style.transform = `translate(${dx}px, ${dy}px)`
          // 강제 리플로우 — 위 transform이 먼저 적용된 뒤에 transition이 걸리게 한다.
          // eslint-disable-next-line no-unused-expressions
          el.offsetHeight
          el.style.transition = 'transform 0.22s ease'
          el.style.transform = ''
        }
      })
    }
    animateContainer(poolRef.current, (key) => !pickedKeySet.has(key))
    animateContainer(assembledRef.current, () => true)
    prevRectsRef.current = newRects
  }, [pickedKeys, segments, checked])

  if (pool.length === 0) {
    return <EmptyState text="문장 배열하기를 하려면 실제 가사에 등장한 단어가 있어야 해요. 아직 그런 단어가 없어요." onBack={onBack} onExit={onExit} />
  }
  if (done) return <DoneScreen text={`${order.length}개 문장을 다 맞췄어요!`} onBack={onBack} onExit={onExit} />
  if (!segments) return null

  function pickTile(tile) {
    if (checked === 'correct' || pickedKeySet.has(tile.key)) return
    setChecked(null)
    setPickedKeys((prev) => [...prev, tile.key])
  }
  function unpickTile(tile) {
    if (checked === 'correct') return
    setChecked(null)
    setPickedKeys((prev) => prev.filter((k) => k !== tile.key))
  }
  function checkAnswer() {
    const assembled = pickedTiles.map((t) => t.text).join('')
    if (assembled === current.exampleText) {
      setChecked('correct')
      setSolvedCount((c) => c + 1)
      onReview?.(current.id, true)
    } else {
      setChecked('wrong')
    }
  }
  function goNext() {
    setSegments(null)
    setPickedKeys([])
    setChecked(null)
    setIndex((i) => i + 1)
  }
  function resetTiles() {
    const segs = mergeWhitespaceSegments(segmentExample(current.exampleText, current.exampleWordSpans))
      .map((text, i) => ({ text, key: `${i}` }))
    setSegments(shuffle(segs))
    setPickedKeys([])
    setChecked(null)
  }

  return (
    <div className="wordbook-study-content">
      <GameHeader title="문장 배열하기" progress={`${index + 1} / ${order.length} (${solvedCount}개 완료)`} />
      <p className="study-reorder-hint">"{current.lemma}"가 쓰인 가사예요. 원래 순서대로 단어를 눌러보세요.</p>
      {current.exampleTranslation && (
        <p className="study-reorder-translation">{current.exampleTranslation}</p>
      )}

      <div
        ref={assembledRef}
        className={`study-reorder-assembled${checked === 'wrong' ? ' study-reorder-assembled--wrong' : ''}${checked === 'correct' ? ' study-reorder-assembled--correct' : ''}`}
      >
        {pickedTiles.map((t) => (
          <button
            type="button"
            key={t.key}
            data-tile-key={t.key}
            className={`study-tile study-tile--word study-tile--picked${dragKey === t.key ? ' study-tile--dragging' : ''}`}
            onClick={() => unpickTile(t)}
            onPointerDown={(e) => handlePointerDown(e, t)}
          >
            {t.text}
          </button>
        ))}
      </div>

      {/* 보기 칸의 타일은 항상 처음 섞인 자리 그대로 그려진다 — 답안 칸으로 옮겨진 타일은
          지우는 게 아니라 자리만 차지한 채 안 보이게(placeholder) 만들어서, 남은 타일들이
          가운데로 쏠려 모이지 않고 처음 자리에 그대로 있게 한다. 다 골라 넣으면(확인 결과가
          나오면) 그 자리를 결과 메시지가 대신 채운다 — 최소 높이를 고정해둔 덕분에 아래
          다시 섞기/확인 버튼 위치는 흔들리지 않는다. */}
      <div ref={poolRef} className={`study-reorder-pool${allPlaced && checked ? ' study-reorder-pool--message' : ''}`}>
        {allPlaced && checked ? (
          <p className={`study-reorder-result${checked === 'correct' ? ' study-reorder-result--correct' : ' study-reorder-result--wrong'}`}>
            {checked === 'correct' ? '정답입니다!' : '다시 생각해 보세요'}
          </p>
        ) : (
          segments.map((t) => {
            const isPicked = pickedKeySet.has(t.key)
            // 이미 답안 칸에 들어간 타일뿐 아니라, 아직 답안 칸까지 끌고 가지는 않았어도
            // 지금 손에 들고 있는(드래그 중인) 타일도 보기 칸에서는 안 보이게 한다 —
            // 답안 칸까지 끌고 가야 거기서 나타난다.
            const hidden = isPicked || dragKey === t.key
            return (
              <button
                type="button"
                key={t.key}
                data-tile-key={t.key}
                className={`study-tile study-tile--word${hidden ? ' study-tile--placeholder' : ''}`}
                tabIndex={hidden ? -1 : 0}
                onClick={() => !hidden && pickTile(t)}
                onPointerDown={(e) => !hidden && handlePointerDown(e, t)}
              >
                {t.text}
              </button>
            )
          })
        )}
      </div>

      {dragKey && (
        <div
          className="study-tile study-tile--word study-reorder-ghost"
          style={{ left: ghostPos.x, top: ghostPos.y }}
        >
          {findTileText(dragKey)}
        </div>
      )}

      <div className="study-reorder-actions">
        <button type="button" className="wordbook-main-back-btn" onClick={resetTiles} disabled={checked === 'correct'}>다시 섞기</button>
        {checked === 'correct' ? (
          <button type="button" className="wordbook-detail-study-btn" onClick={goNext}>다음</button>
        ) : (
          <button type="button" className="wordbook-detail-study-btn" disabled={!allPlaced} onClick={checkAnswer}>확인</button>
        )}
      </div>
    </div>
  )
}

// ---------- 5. 카드 맞추기 ----------
function MatchGame({ items, onReview, onBack, onExit }) {
  // 같은 이유로 items를 진입 시점에 고정 — 짝을 맞춰 onReview가 부모 상태를 갱신해도
  // 카드 구성이 도중에 바뀌지 않는다.
  const [frozenItems] = useState(items)
  const pool = useMemo(() => frozenItems.filter((it) => firstMeaning(it)), [frozenItems])
  const round = useMemo(() => sample(pool, Math.min(5, pool.length)), [pool])
  const wordCards = useMemo(() => shuffle(round.map((it) => ({ itemId: it.id, text: it.lemma }))), [round])
  const meaningCards = useMemo(() => shuffle(round.map((it) => ({ itemId: it.id, text: firstMeaning(it) }))), [round])

  const [selectedWord, setSelectedWord] = useState(null)
  const [selectedMeaning, setSelectedMeaning] = useState(null)
  const [matched, setMatched] = useState(() => new Set())
  const [wrongPair, setWrongPair] = useState(null)

  if (pool.length < 2) {
    return <EmptyState text="카드 맞추기를 하려면 뜻이 있는 단어가 2개 이상 있어야 해요." onBack={onBack} onExit={onExit} />
  }
  if (matched.size === round.length) {
    return <DoneScreen text={`${round.length}쌍을 모두 맞췄어요!`} onBack={onBack} onExit={onExit} />
  }

  function pickWord(card) {
    if (matched.has(card.itemId)) return
    setWrongPair(null)
    setSelectedWord(card.itemId)
    if (selectedMeaning != null) evaluate(card.itemId, selectedMeaning)
  }
  function pickMeaning(card) {
    if (matched.has(card.itemId)) return
    setWrongPair(null)
    setSelectedMeaning(card.itemId)
    if (selectedWord != null) evaluate(selectedWord, card.itemId)
  }
  function evaluate(wordItemId, meaningItemId) {
    if (wordItemId === meaningItemId) {
      setMatched((prev) => new Set(prev).add(wordItemId))
      setSelectedWord(null)
      setSelectedMeaning(null)
      onReview?.(wordItemId, true)
    } else {
      setWrongPair({ wordItemId, meaningItemId })
      setTimeout(() => {
        setSelectedWord(null)
        setSelectedMeaning(null)
        setWrongPair(null)
      }, 500)
    }
  }

  return (
    <div className="wordbook-study-content">
      <GameHeader title="카드 맞추기" progress={`${matched.size} / ${round.length}쌍`} />
      <div className="study-match-grid">
        <div className="study-match-col">
          {wordCards.map((card) => {
            const isMatched = matched.has(card.itemId)
            const isSelected = selectedWord === card.itemId
            const isWrong = wrongPair?.wordItemId === card.itemId
            return (
              <button
                type="button"
                key={card.itemId}
                className={`study-match-card${isMatched ? ' study-match-card--matched' : ''}${isSelected ? ' study-match-card--selected' : ''}${isWrong ? ' study-match-card--wrong' : ''}`}
                onClick={() => pickWord(card)}
                disabled={isMatched}
              >
                {card.text}
              </button>
            )
          })}
        </div>
        <div className="study-match-col">
          {meaningCards.map((card) => {
            const isMatched = matched.has(card.itemId)
            const isSelected = selectedMeaning === card.itemId
            const isWrong = wrongPair?.meaningItemId === card.itemId
            return (
              <button
                type="button"
                key={card.itemId}
                className={`study-match-card${isMatched ? ' study-match-card--matched' : ''}${isSelected ? ' study-match-card--selected' : ''}${isWrong ? ' study-match-card--wrong' : ''}`}
                onClick={() => pickMeaning(card)}
                disabled={isMatched}
              >
                {card.text}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ text, onBack, onExit }) {
  return (
    <div className="wordbook-study-content">
      <div className="wordbook-study-done">
        <p className="wordbook-study-done-text">{text}</p>
        <div className="study-done-actions">
          <button type="button" className="wordbook-detail-study-btn" onClick={onBack}>다른 방법 보기</button>
          <button type="button" className="wordbook-main-back-btn" onClick={onExit}>목록으로</button>
        </div>
      </div>
    </div>
  )
}
