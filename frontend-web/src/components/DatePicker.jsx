import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './DatePicker.css'

// 브랜드 스타일에 맞춘 커스텀 날짜 선택기.
// 네이티브 <input type="date">는 브라우저/OS가 자체 렌더링해서 CSS로 꾸밀 수
// 없기 때문에, 직접 만든 팝업 캘린더로 대체한다.
// value / onChange 는 'YYYY-MM-DD' 형식의 문자열을 그대로 사용해서
// 기존 birthDate state와 호환된다.
//
// 팝업은 document.body에 포탈로 렌더링한다 (position: fixed).
// 그렇지 않으면 일반 문서 흐름에 끼어들어서 부모 컬럼의 높이를 밀어내고,
// 옆의 보라색 브랜드 패널보다 페이지가 더 길어져 그 아래 흰 여백이 생긴다.

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toIso(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

function parseIso(value) {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return { year: y, month: m - 1, day: d }
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function formatDisplay(value) {
  const parsed = parseIso(value)
  if (!parsed) return ''
  return `${parsed.year}년 ${parsed.month + 1}월 ${parsed.day}일`
}

export default function DatePicker({ value, onChange, placeholder = '생년월일 선택', className = '' }) {
  const today = useMemo(() => new Date(), [])
  const selected = parseIso(value)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('days') // 'days' | 'years' | 'months'
  const [viewYear, setViewYear] = useState(selected ? selected.year : today.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected ? selected.month : today.getMonth())
  const [coords, setCoords] = useState(null) // { top, left, width }
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)

  function updateCoords() {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    // 트리거의 오른쪽 끝에 팝업의 오른쪽 끝을 맞춘다 (기본 296px 기준 추정치,
    // 실제 렌더링 후 아래 보정 effect에서 정확한 폭으로 다시 맞춘다).
    const estimatedWidth = 296
    setCoords({ top: rect.bottom + 8, left: rect.right - estimatedWidth, width: rect.width })
  }

  useLayoutEffect(() => {
    if (open) updateCoords()
  }, [open])

  // 트리거 기준으로 일단 배치한 뒤, 팝업이 실제로 렌더링되면 그 높이를 측정해서
  // 화면 아래쪽에 다 들어갈 공간이 없으면 트리거 위쪽으로 뒤집고,
  // 그래도 부족하면 화면 안에 맞춰 클램프한다 (팝업 내부는 스크롤 가능).
  useLayoutEffect(() => {
    if (!open || !coords) return
    const trigger = triggerRef.current
    const popover = popoverRef.current
    if (!trigger || !popover) return

    const margin = 8
    const triggerRect = trigger.getBoundingClientRect()
    const popoverHeight = popover.getBoundingClientRect().height
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth

    let top = triggerRect.bottom + margin
    const fitsBelow = top + popoverHeight <= viewportHeight - margin
    if (!fitsBelow) {
      const topAbove = triggerRect.top - margin - popoverHeight
      if (topAbove >= margin) {
        top = topAbove
      } else {
        // 위/아래 어디에도 완전히 들어가지 않으면 화면 안으로 붙이고
        // 팝업 자체 스크롤로 나머지를 보게 한다.
        top = Math.max(margin, viewportHeight - margin - popoverHeight)
      }
    }

    const popoverWidth = popover.getBoundingClientRect().width
    let left = triggerRect.right - popoverWidth
    const maxLeft = viewportWidth - popoverWidth - margin
    left = Math.min(left, maxLeft)
    left = Math.max(left, margin)

    if (Math.round(top) !== Math.round(coords.top) || Math.round(left) !== Math.round(coords.left)) {
      setCoords((c) => ({ ...c, top, left }))
    }
  }, [open, coords, mode])

  useEffect(() => {
    if (!open) return
    function handleReposition() {
      updateCoords()
    }
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    return () => {
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [open])

  useEffect(() => {
    function handleClickOutside(e) {
      const insideRoot = rootRef.current && rootRef.current.contains(e.target)
      const insidePopover = popoverRef.current && popoverRef.current.contains(e.target)
      if (!insideRoot && !insidePopover) {
        setOpen(false)
        setMode('days')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function openPicker() {
    if (selected) {
      setViewYear(selected.year)
      setViewMonth(selected.month)
    }
    setMode('days')
    setOpen(true)
  }

  function pickDay(day) {
    onChange(toIso(viewYear, viewMonth, day))
    setOpen(false)
    setMode('days')
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  // 날짜 그리드: 이번 달 1일이 무슨 요일인지에 맞춰 빈 칸을 채운다.
  const totalDays = daysInMonth(viewYear, viewMonth)
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  // 연도 선택 그리드: 태어난 해를 고르기 쉽도록 넉넉하게 최근 연도부터 과거로.
  const currentYear = today.getFullYear()
  const YEAR_RANGE_START = currentYear - 99
  const years = []
  for (let y = currentYear; y >= YEAR_RANGE_START; y--) years.push(y)

  const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

  const popoverContent = open && coords && (
    <div
      className="dp-popover"
      role="dialog"
      ref={popoverRef}
      style={{ top: coords.top, left: coords.left }}
    >
      {mode === 'days' && (
        <>
          <div className="dp-header">
            <button type="button" className="dp-nav-btn" onClick={prevMonth} aria-label="이전 달">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <button type="button" className="dp-header-label" onClick={() => setMode('years')}>
              {viewYear}년 {viewMonth + 1}월
            </button>
            <button type="button" className="dp-nav-btn" onClick={nextMonth} aria-label="다음 달">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>

          <div className="dp-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w} className="dp-weekday">{w}</span>
            ))}
          </div>
          <div className="dp-days-grid">
            {cells.map((day, i) => {
              if (day === null) return <span key={`empty-${i}`} className="dp-day dp-day--empty" />
              const isSelected = selected && selected.year === viewYear && selected.month === viewMonth && selected.day === day
              const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day
              return (
                <button
                  type="button"
                  key={day}
                  className={`dp-day${isSelected ? ' dp-day--selected' : ''}${isToday && !isSelected ? ' dp-day--today' : ''}`}
                  onClick={() => pickDay(day)}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </>
      )}

      {mode === 'years' && (
        <>
          <div className="dp-header">
            <span className="dp-header-label dp-header-label--static">연도 선택</span>
          </div>
          <div className="dp-years-grid">
            {years.map((y) => (
              <button
                type="button"
                key={y}
                className={`dp-year${y === viewYear ? ' dp-year--selected' : ''}`}
                onClick={() => {
                  setViewYear(y)
                  setMode('months')
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </>
      )}

      {mode === 'months' && (
        <>
          <div className="dp-header">
            <button type="button" className="dp-nav-btn" onClick={() => setMode('years')} aria-label="연도 다시 선택">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <span className="dp-header-label dp-header-label--static">{viewYear}년</span>
            <span className="dp-nav-btn dp-nav-btn--spacer" />
          </div>
          <div className="dp-months-grid">
            {MONTH_LABELS.map((label, m) => (
              <button
                type="button"
                key={label}
                className={`dp-month${m === viewMonth ? ' dp-month--selected' : ''}`}
                onClick={() => {
                  setViewMonth(m)
                  setMode('days')
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className={`dp-root ${className}`} ref={rootRef}>
      <button
        type="button"
        className="dp-trigger"
        ref={triggerRef}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a89c86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="3"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span className={value ? 'dp-trigger-value' : 'dp-trigger-placeholder'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>

      {open && coords && createPortal(popoverContent, document.body)}
    </div>
  )
}
