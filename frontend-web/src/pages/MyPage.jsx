import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { getMyPage, getMyStats, getMyTitles, updateStatusMessage } from '../api/users'
import { listWordbooks } from '../api/wordbook'
import { listMyPosts, listSavedPosts } from '../api/board'
import { listFriends } from '../api/friends'
import './MyPage.css'

// 학습 통계 4타일/스트릭/칭호/친구는 전부 실제 API(GET /api/users/me/stats,
// GET /api/users/me/titles, GET /api/friends)로 받아온다(친구는 2026-10-08(3차), 18번 참고 —
// 이전엔 Friendship 기능 자체가 없어서 더미 데이터로 자리만 채워뒀었다).
const EMPTY_STATS = {
  wordsLearned: 0,
  linesCompleted: 0,
  songsCompleted: 0,
  currentStreakDays: 0,
  longestStreakDays: 0,
  totalActiveDays: 0,
  calendar: [],
}

const EMPTY_TITLES = { categories: [], equippedTitleCode: null, equippedTitleName: null }

// 칭호 카드에 보여줄 "보유 칭호" 요약 — 카테고리별로 가장 높은 단계의 달성 칭호 하나만
// 뽑는다(낮은 단계는 상위 단계에 포함되는 의미라 전부 나열할 필요가 없다). 여기서는
// 착용(대표 칭호 설정) 없이 그냥 나열만 한다 — 대표 칭호 설정은 "더보기"로 들어가는
// 칭호 전체 페이지(TitlesPage.jsx)에서만 할 수 있다(claude/소셜_마이페이지_기획.md 15-6번).
function pickHighestAchievedPerCategory(categories) {
  const result = []
  for (const group of categories) {
    let best = null
    for (const t of group.titles) {
      if (t.achieved) best = t
    }
    if (best) result.push({ ...best, categoryLabel: group.categoryLabel })
  }
  return result
}

// 스트릭 캘린더 요일 헤더 — 백엔드(LearningStatsService.buildCalendar)가 일요일 시작
// 5주로 정렬해서 내려주므로 그에 맞춘다.
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// 칸 색 농도 — 그날 단어 복습 횟수(wordReviewCount)에 비례. 절대 구간으로 나눠서
// GitHub 잔디밭처럼 "많이 할수록 진해지는" 느낌을 준다(사용자 간 상대 비교가 아니라
// 매번 같은 기준이라 보기에 안정적). 이번 주의 아직 안 지난 미래 칸은 "0개라서 회색"과
// 구분되도록 더 옅게 비워둔다.
// 2026-10-07 피드백 — 공부를 조금만 해도 바로 가장 진한 단계로 뛰어서(구간 폭이
// 너무 좁았음) 비현실적으로 진해 보였다. 구간을 더 넓게(그리고 한 단계 추가해서
// 더 완만하게) 잡아 실제 학습량과 진하기가 자연스럽게 비례하도록 한다.
function streakCellColor(day, today) {
  if (!day || !day.date) return '#ececec'
  if (day.date > today) return '#f7f7f7' // 아직 오지 않은 날
  const count = day.wordReviewCount ?? 0
  if (count <= 0) return '#ececec'
  if (count <= 3) return '#e4d6fa'
  if (count <= 8) return '#c7acf3'
  if (count <= 15) return '#9c6eec'
  if (count <= 25) return '#7636f6'
  return '#4c1ecf'
}

// 칸 안 날짜 글씨 색 — 배경 진하기에 따라 명암 대비를 맞춘다. 기존엔 "오늘" 칸만
// 고정된 보라색(#5f26f3) 글씨를 썼는데, 오늘 학습량이 많아 배경 자체가 같은
// 보라색 계열의 진한 색이 되면 글씨와 배경이 거의 같은 색이 되어 날짜가
// 안 보이는 문제가 있었다(2026-10-07 피드백). 배경 농도 구간별로 밝은/어두운
// 글씨를 골라 항상 읽히도록 한다.
function streakCellTextColor(day, today) {
  if (!day || !day.date) return 'rgba(32, 26, 20, 0.45)'
  if (day.date > today) return 'rgba(32, 26, 20, 0.3)' // 아직 오지 않은 날
  const isToday = day.date === today
  const count = day.wordReviewCount ?? 0
  if (count <= 8) {
    // 배경이 밝은 구간 — 짙은 글씨(오늘은 포인트 보라색으로 강조)
    return isToday ? '#5f26f3' : 'rgba(32, 26, 20, 0.55)'
  }
  // 배경이 진한 구간 — 흰 글씨라야 대비가 나온다
  return isToday ? '#ffffff' : 'rgba(255, 255, 255, 0.92)'
}

// 친구 카드엔 아바타를 최대 4개까지만 보여주고, 그 이상은 "+N"으로 뭉친다(와이어프레임
// 그대로, PLACEHOLDER_FRIENDS 더미 시절의 레이아웃을 실제 데이터로 유지).
const FRIEND_AVATAR_DISPLAY_LIMIT = 4

const LEARNING_LANG_LABELS = { ja: '일본어 학습 중' }

// 일본어 국기를 흉내낸 원형 배지 — 와이어프레임 그대로(흰 바탕 + 빨간 점 + 얇은 테두리).
// 학습 언어가 늘어나면 깃발 색상표를 따로 두고 분기하면 된다.
function LearningLangBadge({ flag }) {
  const dotColor = flag === 'ja' ? '#bc002d' : '#7636f6'
  return (
    <span className="mypage-flag-badge">
      <span className="mypage-flag-dot" style={{ background: dotColor }} />
    </span>
  )
}

// 게시글 미리보기 한 줄 — "내가 올린 게시글"에서 사용(좋아요/댓글 수 표시).
function MyPostRow({ post, onClick }) {
  return (
    <a href="#" className="mypage-list-row" onClick={(e) => { e.preventDefault(); onClick() }}>
      <span className="mypage-list-row-title">{post.title}</span>
      <span className="mypage-list-row-stats">
        &#9825; {post.likeCount} &nbsp; &#128172; {post.commentCount}
      </span>
    </a>
  )
}

// "저장한 게시글"에서 사용(작성자 표시) — 폴더 분류는 아직 없음(2-1 SavedPostFolder 참고).
function SavedPostRow({ post, onClick }) {
  return (
    <a href="#" className="mypage-list-row" onClick={(e) => { e.preventDefault(); onClick() }}>
      <div className="mypage-list-row-main">
        <span className="mypage-list-row-title">{post.title}</span>
        <span className="mypage-list-row-sub">{post.authorNickname}</span>
      </div>
      <span className="mypage-list-row-stats">&#9825; {post.likeCount}</span>
    </a>
  )
}

// 마이페이지 — claude/소셜_마이페이지_기획.md 5번/10번. 레이아웃은 Design 캔버스
// 와이어프레임(Main.dc.html)과 동일하게 맞췄다. 학습 통계/스트릭/칭호/친구는 계측·설계가
// 아직 없어 더미 데이터로 자리만 채워둔 상태(위 PLACEHOLDER_* 참고).
export default function MyPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [editingStatus, setEditingStatus] = useState(false)
  const [statusDraft, setStatusDraft] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)

  const [stats, setStats] = useState(EMPTY_STATS)
  const [statsLoading, setStatsLoading] = useState(true)

  const [books, setBooks] = useState([])
  const [booksLoading, setBooksLoading] = useState(true)

  const [myPosts, setMyPosts] = useState([])
  const [myPostsLoading, setMyPostsLoading] = useState(true)

  const [savedPosts, setSavedPosts] = useState([])
  const [savedPostsLoading, setSavedPostsLoading] = useState(true)

  // 대표 칭호 설정(착용)은 더 이상 여기서 하지 않는다 — "더보기"로 들어가는
  // 칭호 전체 페이지(TitlesPage.jsx)로 옮겼고, 여기서는 보유 칭호를 그냥
  // 나열만 한다.
  const [titles, setTitles] = useState(EMPTY_TITLES)
  const [titlesLoading, setTitlesLoading] = useState(true)

  // 친구 — claude/소셜_마이페이지_기획.md 18번(2026-10-08(3차))부터 실제 데이터.
  const [friends, setFriends] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(true)

  function loadTitles() {
    setTitlesLoading(true)
    return getMyTitles()
      .then((data) => setTitles(data || EMPTY_TITLES))
      .catch(() => setTitles(EMPTY_TITLES))
      .finally(() => setTitlesLoading(false))
  }

  useEffect(() => {
    getMyPage()
      .then((data) => {
        setProfile(data)
        setStatusDraft(data.statusMessage || '')
      })
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false))

    getMyStats()
      .then((data) => setStats(data || EMPTY_STATS))
      .catch(() => setStats(EMPTY_STATS))
      .finally(() => setStatsLoading(false))

    listWordbooks()
      .then((data) => setBooks((data || []).filter((b) => !b.favoriteDefault)))
      .catch(() => setBooks([]))
      .finally(() => setBooksLoading(false))

    listMyPosts()
      .then(setMyPosts)
      .catch(() => setMyPosts([]))
      .finally(() => setMyPostsLoading(false))

    listSavedPosts()
      .then(setSavedPosts)
      .catch(() => setSavedPosts([]))
      .finally(() => setSavedPostsLoading(false))

    loadTitles()

    setFriendsLoading(true)
    listFriends()
      .then((data) => setFriends(data || []))
      .catch(() => setFriends([]))
      .finally(() => setFriendsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSaveStatus() {
    setStatusSaving(true)
    try {
      const updated = await updateStatusMessage(statusDraft.trim())
      setProfile(updated)
      setEditingStatus(false)
    } catch {
      // 실패하면 편집 상태를 유지해서 다시 시도할 수 있게 한다.
    } finally {
      setStatusSaving(false)
    }
  }

  return (
    <div className="mypage-page">
      <TopBar showSearch={false} />

      <div className="mypage-shell">
        {/* 프로필 카드 */}
        {profileLoading ? (
          <div className="mypage-status">불러오는 중...</div>
        ) : !profile ? (
          <div className="mypage-status mypage-status--error">프로필을 불러오지 못했어요.</div>
        ) : (
          <section className="mypage-profile-card">
            <div className="mypage-profile-left">
              <div className="mypage-avatar" style={{ background: profile.avatarColor || '#f2f2f2' }}>
                {profile.avatarInitial}
              </div>
              <div className="mypage-profile-main">
                <div className="mypage-profile-name-row">
                  <span className="mypage-profile-name">{profile.nickname}</span>
                  <span className="mypage-profile-title">{profile.title}</span>
                </div>
                <div className="mypage-profile-flag-row">
                  <LearningLangBadge flag={profile.learningLangFlag} />
                  <span className="mypage-profile-flag-label">
                    {LEARNING_LANG_LABELS[profile.learningLangFlag] || '학습 중'}
                  </span>
                </div>
                {editingStatus ? (
                  <div className="mypage-status-edit">
                    <input
                      type="text"
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value)}
                      placeholder="한 줄 소개를 입력해주세요"
                      maxLength={80}
                      autoFocus
                    />
                    <button type="button" onClick={handleSaveStatus} disabled={statusSaving}>
                      {statusSaving ? '저장 중...' : '저장'}
                    </button>
                    <button
                      type="button"
                      className="mypage-status-edit-cancel"
                      onClick={() => {
                        setEditingStatus(false)
                        setStatusDraft(profile.statusMessage || '')
                      }}
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="mypage-profile-status">
                    {profile.statusMessage || '한 줄 소개를 추가해보세요'}
                  </div>
                )}
              </div>
            </div>
            {!editingStatus && (
              <button type="button" className="mypage-profile-edit-btn" onClick={() => setEditingStatus(true)}>
                프로필 수정
              </button>
            )}
          </section>
        )}

        {/* 학습 통계 — GET /api/users/me/stats (10번 참고) */}
        <div className="mypage-stats-grid">
          <div className="mypage-stat-tile">
            <div className="mypage-stat-label">학습한 단어</div>
            <div className="mypage-stat-value">{statsLoading ? '-' : `${stats.wordsLearned}개`}</div>
          </div>
          <div className="mypage-stat-tile">
            <div className="mypage-stat-label">학습한 가사</div>
            <div className="mypage-stat-value">{statsLoading ? '-' : `${stats.linesCompleted}줄`}</div>
          </div>
          <div className="mypage-stat-tile">
            <div className="mypage-stat-label">학습한 곡</div>
            <div className="mypage-stat-value">{statsLoading ? '-' : `${stats.songsCompleted}곡`}</div>
          </div>
          <div className="mypage-stat-tile">
            <div className="mypage-stat-label">
              학습일수
              {stats.currentStreakDays >= 3 && ' 🔥'}
            </div>
            <div className="mypage-stat-value">{statsLoading ? '-' : `${stats.totalActiveDays}일`}</div>
          </div>
        </div>

        {/* 메인 2단 레이아웃 */}
        <div className="mypage-columns">
          {/* 메인 컬럼 */}
          <div className="mypage-main-col">

            {/* 내 단어장 */}
            <section className="mypage-card">
              <div className="mypage-card-head">
                <h2>내 단어장</h2>
                <button type="button" className="mypage-card-link" onClick={() => navigate('/wordbook')}>
                  모두 보기
                </button>
              </div>
              {booksLoading ? (
                <div className="mypage-status">불러오는 중...</div>
              ) : (
                <div className="mypage-wordbook-grid">
                  {books.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      className="mypage-wordbook-card"
                      onClick={() => navigate(`/wordbook/${book.id}`)}
                    >
                      <div className="mypage-wordbook-card-top">
                        {!book.isPublic && (
                          <span className="mypage-wordbook-lock">
                            <svg width="15" height="15" viewBox="0 0 20 20">
                              <path
                                fill="#FFC53D"
                                fillRule="evenodd"
                                d="M10 1a4 4 0 0 0-4 4v2H5a1 1 0 0 0-1 1v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4zm2 6V5a2 2 0 1 0-4 0v2h4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </span>
                        )}
                      </div>
                      <span className="mypage-wordbook-emoji">{book.emoji || '📘'}</span>
                      <span className="mypage-wordbook-name">{book.name}</span>
                      <span className="mypage-wordbook-count">{book.itemCount}개 단어</span>
                    </button>
                  ))}
                  <button type="button" className="mypage-wordbook-card mypage-wordbook-card--new" onClick={() => navigate('/wordbook')}>
                    <span className="mypage-wordbook-new-icon">+</span>
                    <span className="mypage-wordbook-name">새 단어장 만들기</span>
                  </button>
                </div>
              )}
            </section>

            {/* 단어장 둘러보기 배너 */}
            <button type="button" className="mypage-board-banner" onClick={() => navigate('/board')}>
              <div className="mypage-board-banner-left">
                <div className="mypage-board-banner-icon">📖</div>
                <div>
                  <div className="mypage-board-banner-title">단어장 둘러보기</div>
                  <div className="mypage-board-banner-sub">다른 사람들이 공유한 단어장을 내 단어장에 추가해보세요</div>
                </div>
              </div>
              <div className="mypage-board-banner-arrow">&rarr;</div>
            </button>

            {/* 내가 올린 게시글 */}
            <section className="mypage-card">
              <div className="mypage-card-head">
                <h2>내가 올린 게시글</h2>
                <button type="button" className="mypage-card-link" onClick={() => navigate('/board')}>
                  모두 보기
                </button>
              </div>
              {myPostsLoading ? (
                <div className="mypage-status">불러오는 중...</div>
              ) : myPosts.length === 0 ? (
                <div className="mypage-status">아직 올린 게시글이 없어요.</div>
              ) : (
                <div className="mypage-list">
                  {myPosts.map((post) => (
                    <MyPostRow key={post.id} post={post} onClick={() => navigate(`/board/${post.id}`)} />
                  ))}
                </div>
              )}
            </section>

            {/* 저장한 게시글 */}
            <section className="mypage-card">
              <div className="mypage-card-head">
                <h2>저장한 게시글</h2>
                <button type="button" className="mypage-card-link" onClick={() => navigate('/board')}>
                  모두 보기
                </button>
              </div>
              {savedPostsLoading ? (
                <div className="mypage-status">불러오는 중...</div>
              ) : savedPosts.length === 0 ? (
                <div className="mypage-status">아직 저장한 게시글이 없어요.</div>
              ) : (
                <div className="mypage-list">
                  {savedPosts.map((post) => (
                    <SavedPostRow key={post.id} post={post} onClick={() => navigate(`/board/${post.id}`)} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* 사이드바 */}
          <div className="mypage-side-col">

            {/* 학습 스트릭 캘린더 — GET /api/users/me/stats (10번 참고) */}
            <section className="mypage-card mypage-card--side">
              <div className="mypage-side-head">
                <span>학습 스트릭</span>
                <span>🔥</span>
              </div>
              <div className="mypage-side-sub">
                {statsLoading
                  ? '불러오는 중...'
                  : stats.currentStreakDays > 0
                    ? `${stats.currentStreakDays}일 연속 학습 중이에요`
                    : '아직 학습 기록이 없어요'}
              </div>
              {/* 요일 헤더 — 백엔드가 일요일 시작 5주로 정렬해서 내려주므로 그대로 맞춘다. */}
              <div className="mypage-streak-weekdays">
                {WEEKDAY_LABELS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="mypage-streak-grid">
                {(stats.calendar.length > 0 ? stats.calendar : Array.from({ length: 35 }, () => ({ active: false, wordReviewCount: 0, date: null })))
                  .map((d, i) => {
                    const today = todayIso()
                    const dayOfMonth = d.date ? Number(d.date.slice(8, 10)) : null
                    return (
                      <div
                        key={d.date || i}
                        className={`mypage-streak-cell${d.date === today ? ' mypage-streak-cell--today' : ''}`}
                        style={{ background: streakCellColor(d, today) }}
                        title={d.date ? `${d.date} · 단어 복습 ${d.wordReviewCount ?? 0}회` : undefined}
                      >
                        {dayOfMonth !== null && (
                          <span
                            className="mypage-streak-cell-date"
                            style={{ color: streakCellTextColor(d, today) }}
                          >
                            {dayOfMonth}
                          </span>
                        )}
                      </div>
                    )
                  })}
              </div>
            </section>

            {/* 칭호 — GET /api/users/me/titles (claude/소셜_마이페이지_기획.md 15-6번).
                여기서는 보유 칭호를 그냥 나열만 하고, 대표 칭호 설정(착용)은 "더보기"로
                들어가는 칭호 전체 페이지(TitlesPage.jsx)에서만 할 수 있다. */}
            <section className="mypage-card mypage-card--side">
              <div className="mypage-side-head">
                <span>칭호</span>
                <Link to="/mypage/titles" className="mypage-side-add">더보기</Link>
              </div>
              {titlesLoading ? (
                <div className="mypage-status">불러오는 중...</div>
              ) : (
                <div className="mypage-title-chips">
                  {pickHighestAchievedPerCategory(titles.categories).length === 0 ? (
                    <div className="mypage-status">아직 획득한 칭호가 없어요. 학습을 시작해보세요!</div>
                  ) : (
                    pickHighestAchievedPerCategory(titles.categories).map((t) => (
                      <span key={t.code} className="mypage-title-chip" title={t.categoryLabel}>
                        {t.name}
                      </span>
                    ))
                  )}
                </div>
              )}
            </section>

            {/* 친구 — claude/소셜_마이페이지_기획.md 18번(2026-10-08(3차))부터 실제 구현.
                검색/요청/수락·거절은 전용 /friends 페이지에서 처리하고, 여기서는 친구 수 +
                아바타 몇 개만 요약해서 보여준다. */}
            <section className="mypage-card mypage-card--side">
              <div className="mypage-side-head">
                <span>친구 {friendsLoading ? '' : friends.length}</span>
                <Link to="/friends" className="mypage-side-add">+ 추가</Link>
              </div>
              {friendsLoading ? (
                <div className="mypage-status">불러오는 중...</div>
              ) : friends.length === 0 ? (
                <div className="mypage-status">아직 친구가 없어요. "+ 추가"로 검색해보세요!</div>
              ) : (
                <div className="mypage-friends-row">
                  {friends.slice(0, FRIEND_AVATAR_DISPLAY_LIMIT).map((f) => (
                    <div
                      key={f.userId}
                      className="mypage-friend-avatar"
                      style={{ background: f.avatarColor || '#f2f2f2' }}
                      title={f.nickname}
                    >
                      {f.avatarInitial}
                    </div>
                  ))}
                  {friends.length > FRIEND_AVATAR_DISPLAY_LIMIT && (
                    <div className="mypage-friend-avatar">
                      +{friends.length - FRIEND_AVATAR_DISPLAY_LIMIT}
                    </div>
                  )}
                </div>
              )}
            </section>

          </div>
        </div>
      </div>
    </div>
  )
}
