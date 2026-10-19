import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TopBar from '../components/TopBar'
import ConfirmModal from '../components/ConfirmModal'
import {
  searchFriends,
  sendFriendRequest,
  listIncomingRequests,
  listOutgoingRequests,
  acceptRequest,
  declineRequest,
  cancelRequest,
  listFriends,
  removeFriend,
} from '../api/friends'
import './Friends.css'

// 검색 결과 버튼의 상태별 라벨/활성화 여부 — relation은 백엔드 FriendRelationStatus 그대로.
// (버튼 문구는 화면에서 t(`relation.${relation}`)로 번역한다)
const RELATION_META = {
  NONE: { disabled: false },
  PENDING_OUTGOING: { disabled: true },
  PENDING_INCOMING: { disabled: true },
  FRIENDS: { disabled: true },
}

function formatDate(iso) {
  if (!iso) return ''
  return iso.slice(0, 10).replaceAll('-', '.')
}

function Avatar({ color, initial }) {
  return (
    <div className="friends-avatar" style={{ background: color || '#f2f2f2' }}>
      {initial}
    </div>
  )
}

// 친구 페이지 — claude/소셜_마이페이지_기획.md 4번(설계) / 18번(구현). 닉네임 검색 +
// 요청 보내기/받기/수락/거절/취소 + 내 친구 목록을 전부 한 화면에서 처리하는 전용 페이지로
// 만들었다(마이페이지 사이드바 "+ 추가"가 여기로 연결된다). 디자인은 미리 Artifact로
// 만든 목업을 그대로 코드화했다.
export default function Friends() {
  const { t } = useTranslation('friends')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [sendingUserId, setSendingUserId] = useState(null)

  const [incoming, setIncoming] = useState([])
  const [incomingLoading, setIncomingLoading] = useState(true)
  const [outgoing, setOutgoing] = useState([])
  const [outgoingLoading, setOutgoingLoading] = useState(true)

  const [friends, setFriends] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(true)

  const [removeTarget, setRemoveTarget] = useState(null) // { userId, nickname } | null
  const [removing, setRemoving] = useState(false)

  function loadIncoming() {
    setIncomingLoading(true)
    return listIncomingRequests()
      .then((data) => setIncoming(data || []))
      .catch(() => setIncoming([]))
      .finally(() => setIncomingLoading(false))
  }

  function loadOutgoing() {
    setOutgoingLoading(true)
    return listOutgoingRequests()
      .then((data) => setOutgoing(data || []))
      .catch(() => setOutgoing([]))
      .finally(() => setOutgoingLoading(false))
  }

  function loadFriends() {
    setFriendsLoading(true)
    return listFriends()
      .then((data) => setFriends(data || []))
      .catch(() => setFriends([]))
      .finally(() => setFriendsLoading(false))
  }

  useEffect(() => {
    loadIncoming()
    loadOutgoing()
    loadFriends()
  }, [])

  // 검색어 입력 300ms 디바운스 — 매 타이핑마다 요청을 쏘지 않도록.
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setSearchError(null)
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      searchFriends(trimmed)
        .then((data) => {
          setResults(data || [])
          setSearchError(null)
        })
        .catch(() => setSearchError(true))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  async function handleSendRequest(userId) {
    setSendingUserId(userId)
    try {
      await sendFriendRequest(userId)
      setResults((prev) =>
        prev.map((r) => (r.userId === userId ? { ...r, relation: 'PENDING_OUTGOING' } : r)),
      )
      loadOutgoing()
    } catch {
      // 이미 관계가 있는 경우 등 — 조용히 무시하고 결과는 그대로 둔다.
    } finally {
      setSendingUserId(null)
    }
  }

  async function handleAccept(requestId) {
    try {
      await acceptRequest(requestId)
      setIncoming((prev) => prev.filter((r) => r.requestId !== requestId))
      loadFriends()
    } catch {
      // no-op
    }
  }

  async function handleDecline(requestId) {
    try {
      await declineRequest(requestId)
      setIncoming((prev) => prev.filter((r) => r.requestId !== requestId))
    } catch {
      // no-op
    }
  }

  async function handleCancel(requestId) {
    try {
      await cancelRequest(requestId)
      setOutgoing((prev) => prev.filter((r) => r.requestId !== requestId))
    } catch {
      // no-op
    }
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await removeFriend(removeTarget.userId)
      setFriends((prev) => prev.filter((f) => f.userId !== removeTarget.userId))
      setRemoveTarget(null)
    } catch {
      // no-op — 모달은 유지, 사용자가 다시 시도할 수 있게.
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="friends-page">
      <TopBar showSearch={false} />

      <div className="friends-shell">
        <div>
          <h1 className="friends-title">{t('title')}</h1>
          <div className="friends-sub">{t('sub')}</div>
        </div>

        <div className="friends-search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {query.trim() && (
          <section className="friends-card">
            <div className="friends-card-head">
              <h2>{t('results')}</h2>
            </div>
            {searching ? (
              <div className="friends-empty">{t('searching')}</div>
            ) : searchError ? (
              <div className="friends-empty">{t('searchError')}</div>
            ) : results.length === 0 ? (
              <div className="friends-empty">{t('noResults')}</div>
            ) : (
              results.map((r) => {
                const meta = RELATION_META[r.relation] || RELATION_META.NONE
                return (
                  <div className="friends-row" key={r.userId}>
                    <div className="friends-row-left">
                      <Avatar color={r.avatarColor} initial={r.avatarInitial} />
                      <div>
                        <div className="friends-row-name">{r.nickname}</div>
                        <div className="friends-row-sub">
                          {t(`relationSub.${RELATION_META[r.relation] ? r.relation : 'NONE'}`)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`friends-btn${meta.disabled ? ' friends-btn--disabled' : ' friends-btn--primary'}`}
                      disabled={meta.disabled || sendingUserId === r.userId}
                      onClick={() => handleSendRequest(r.userId)}
                    >
                      {sendingUserId === r.userId ? t('sending') : t(`relation.${RELATION_META[r.relation] ? r.relation : 'NONE'}`)}
                    </button>
                  </div>
                )
              })
            )}
          </section>
        )}

        <section className="friends-card">
          <div className="friends-card-head">
            <h2>{t('incoming')}</h2>
            {incoming.length > 0 && <span className="friends-count">{incoming.length}</span>}
          </div>
          {incomingLoading ? (
            <div className="friends-empty">{t('common:actions.loading')}</div>
          ) : incoming.length === 0 ? (
            <div className="friends-empty">{t('incomingEmpty')}</div>
          ) : (
            incoming.map((r) => (
              <div className="friends-row" key={r.requestId}>
                <div className="friends-row-left">
                  <Avatar color={r.avatarColor} initial={r.avatarInitial} />
                  <div>
                    <div className="friends-row-name">{r.nickname}</div>
                    <div className="friends-row-sub">{formatDate(r.createdAt)}</div>
                  </div>
                </div>
                <div className="friends-btn-group">
                  <button type="button" className="friends-btn friends-btn--outline" onClick={() => handleDecline(r.requestId)}>
                    {t('decline')}
                  </button>
                  <button type="button" className="friends-btn friends-btn--primary" onClick={() => handleAccept(r.requestId)}>
                    {t('accept')}
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="friends-card">
          <div className="friends-card-head">
            <h2>{t('outgoing')}</h2>
            {outgoing.length > 0 && <span className="friends-count">{outgoing.length}</span>}
          </div>
          {outgoingLoading ? (
            <div className="friends-empty">{t('common:actions.loading')}</div>
          ) : outgoing.length === 0 ? (
            <div className="friends-empty">{t('outgoingEmpty')}</div>
          ) : (
            outgoing.map((r) => (
              <div className="friends-row" key={r.requestId}>
                <div className="friends-row-left">
                  <Avatar color={r.avatarColor} initial={r.avatarInitial} />
                  <div>
                    <div className="friends-row-name">{r.nickname}</div>
                    <div className="friends-row-sub">{t('waiting')}</div>
                  </div>
                </div>
                <button type="button" className="friends-btn friends-btn--ghost" onClick={() => handleCancel(r.requestId)}>
                  {t('cancelRequest')}
                </button>
              </div>
            ))
          )}
        </section>

        <section className="friends-card">
          <div className="friends-card-head">
            <h2>{t('myFriends')}</h2>
            {friends.length > 0 && <span className="friends-count">{friends.length}</span>}
          </div>
          {friendsLoading ? (
            <div className="friends-empty">{t('common:actions.loading')}</div>
          ) : friends.length === 0 ? (
            <div className="friends-empty">{t('friendsEmpty')}</div>
          ) : (
            <div className="friends-grid">
              {friends.map((f) => (
                <div className="friends-friend-card" key={f.userId}>
                  <Avatar color={f.avatarColor} initial={f.avatarInitial} />
                  <div className="friends-friend-info">
                    <div className="friends-row-name">{f.nickname}</div>
                    <div className="friends-row-sub">{f.statusMessage || t('noStatus')}</div>
                  </div>
                  <button
                    type="button"
                    className="friends-remove-btn"
                    onClick={() => setRemoveTarget({ userId: f.userId, nickname: f.nickname })}
                    aria-label={t('removeAria')}
                  >
                    &#10005;
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {removeTarget && (
        <ConfirmModal
          title={t('removeConfirm.title')}
          message={t('removeConfirm.message', { nickname: removeTarget.nickname })}
          confirmLabel={t('removeConfirm.confirm')}
          danger
          busy={removing}
          onConfirm={handleConfirmRemove}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  )
}
