import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/notifications'
import { formatDate, formatRelative } from '../i18n/format'
import './NotificationBell.css'

// 알림 종 아이콘 + 드롭다운 — claude/소셜_마이페이지_기획.md 21번. TopBar.jsx에 있던
// 더미 종 버튼(클릭 핸들러 자체가 없고, 배지 숫자 "3"이 하드코딩)을 실제 기능으로
// 교체한 컴포넌트. 안 읽은 개수는 마운트 시 + 30초마다 폴링(이 프로젝트에 실시간 푸시
// 인프라가 없어서 가장 단순한 방식을 택함), 목록은 드롭다운을 열 때만 불러온다.
const POLL_INTERVAL_MS = 30000

// "방금 전 / 5분 전 / 3시간 전 / 2일 전" — 일주일이 넘으면 날짜로. 표기는 언어별 Intl이 만든다.
function formatRelativeTime(iso, lang, justNowText) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return justNowText
  if (diffMin < 60) return formatRelative(lang, -diffMin, 'minute')
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return formatRelative(lang, -diffHour, 'hour')
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return formatRelative(lang, -diffDay, 'day')
  return formatDate(lang, new Date(iso), { dateStyle: 'medium' })
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('common')
  const lang = i18n.resolvedLanguage || 'ko'
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const btnRef = useRef(null)
  const panelRef = useRef(null)

  function refreshUnreadCount() {
    getUnreadNotificationCount()
      .then((res) => setUnreadCount(res?.count || 0))
      .catch(() => {})
  }

  useEffect(() => {
    refreshUnreadCount()
    const timer = setInterval(refreshUnreadCount, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      const target = e.target
      if (panelRef.current?.contains(target) || btnRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) {
      setLoading(true)
      listNotifications({ size: 20 })
        .then((res) => setItems(res?.content || []))
        .catch(() => setItems([]))
        .finally(() => setLoading(false))
    }
  }

  async function handleItemClick(item) {
    setOpen(false)
    if (!item.read) {
      try {
        await markNotificationRead(item.id)
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch {
        // no-op — 읽음 처리가 실패해도 이동은 그대로 진행.
      }
    }
    navigate(item.targetUrl || '/')
  }

  async function handleMarkAllRead(e) {
    e.stopPropagation()
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // no-op
    }
  }

  return (
    <>
      <button aria-label={t('notifications.aria')} onClick={toggleOpen} className="home-icon-btn home-bell-btn" ref={btnRef}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span className="home-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" ref={panelRef}>
          <div className="notif-dropdown-header">
            <span>{t('notifications.title')}</span>
            {items.some((n) => !n.read) && (
              <button type="button" className="notif-mark-all-btn" onClick={handleMarkAllRead}>
                {t('notifications.markAll')}
              </button>
            )}
          </div>
          <div className="notif-dropdown-list">
            {loading ? (
              <div className="notif-empty">{t('actions.loading')}</div>
            ) : items.length === 0 ? (
              <div className="notif-empty">{t('notifications.empty')}</div>
            ) : (
              items.map((n) => (
                <button
                  type="button"
                  key={n.id}
                  className={`notif-item${n.read ? '' : ' notif-item--unread'}`}
                  onClick={() => handleItemClick(n)}
                >
                  <div className="notif-item-avatar" style={{ background: n.actorAvatarColor || '#f2f2f2' }}>
                    {n.actorAvatarInitial}
                  </div>
                  <div className="notif-item-body">
                    <div className="notif-item-message">{n.message}</div>
                    <div className="notif-item-time">{formatRelativeTime(n.createdAt, lang, t('notifications.justNow'))}</div>
                  </div>
                  {!n.read && <span className="notif-item-dot" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
