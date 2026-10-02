import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { getMyPage, getMyStats, updateStatusMessage } from '../api/users'
import { listWordbooks } from '../api/wordbook'
import { listMyPosts, listSavedPosts } from '../api/board'
import './MyPage.css'

// 칭호/친구는 아직 설계·계측이 없어서(claude/소셜_마이페이지_기획.md 10번 참고) 와이어프레임과
// 레이아웃을 맞추기 위한 용도로만 더미 데이터를 쓴다. 학습 통계 4타일/스트릭은 실제
// GET /api/users/me/stats로 받아온다(2026-10-02).
const EMPTY_STATS = {
  wordsLearned: 0,
  linesCompleted: 0,
  songsCompleted: 0,
  currentStreakDays: 0,
  longestStreakDays: 0,
  calendar: [],
}

const PLACEHOLDER_TITLES = [
  { icon: '🌱', label: '새싹 학습자', bg: '#f2f2f2', textColor: '#5b5346', iconOpacity: 1, current: false },
  { icon: '🎵', label: '가사 탐험가', bg: '#f4efff', textColor: '#7636f6', iconOpacity: 1, current: true },
  { icon: '📖', label: '성실한 독서가', bg: '#f7f7f7', textColor: '#a89c86', iconOpacity: 0.4, current: false },
]

const PLACEHOLDER_FRIENDS = [
  { label: '하늘' },
  { label: '유진' },
  { label: '준호' },
  { label: '+4' },
]
const PLACEHOLDER_FRIEND_COUNT = 7

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
              연속 학습일
              {stats.currentStreakDays >= 3 && ' 🔥'}
            </div>
            <div className="mypage-stat-value">{statsLoading ? '-' : `${stats.currentStreakDays}일`}</div>
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
              <div className="mypage-streak-grid">
                {(stats.calendar.length > 0 ? stats.calendar : Array.from({ length: 35 }, () => ({ active: false })))
                  .map((d, i) => (
                    <div
                      key={d.date || i}
                      className="mypage-streak-cell"
                      style={{ background: d.active ? '#7636f6' : '#ececec' }}
                    />
                  ))}
              </div>
            </section>

            {/* 칭호 컬렉션 (더미) */}
            <section className="mypage-card mypage-card--side">
              <div className="mypage-side-title">칭호 컬렉션</div>
              <div className="mypage-title-list">
                {PLACEHOLDER_TITLES.map((t) => (
                  <div key={t.label} className="mypage-title-row" style={{ background: t.bg }}>
                    <span style={{ opacity: t.iconOpacity }}>{t.icon}</span>
                    <span className="mypage-title-label" style={{ color: t.textColor }}>{t.label}</span>
                    {t.current && <span className="mypage-title-current">착용중</span>}
                  </div>
                ))}
              </div>
              <div className="mypage-title-progress-label">다음 칭호까지 120 단어</div>
              <div className="mypage-title-progress-track">
                <div className="mypage-title-progress-fill" style={{ width: '62%' }} />
              </div>
            </section>

            {/* 친구 (더미) */}
            <section className="mypage-card mypage-card--side">
              <div className="mypage-side-head">
                <span>친구 {PLACEHOLDER_FRIEND_COUNT}</span>
                <a href="#" className="mypage-side-add" onClick={(e) => e.preventDefault()}>+ 추가</a>
              </div>
              <div className="mypage-friends-row">
                {PLACEHOLDER_FRIENDS.map((f, i) => (
                  <div key={i} className="mypage-friend-avatar">{f.label}</div>
                ))}
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  )
}
