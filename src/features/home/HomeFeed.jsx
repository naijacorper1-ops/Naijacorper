import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Image as ImageIcon, BarChart3, MapPin, TrendingUp } from 'lucide-react'
import PostCard from '../../components/post/PostCard'
import { useApp } from '../../context/AppContext'
import { trending, suggested, users, currentUser } from '../../data/mock'

const TABS = [
  { id: 'foryou', label: 'For you' },
  { id: 'following', label: 'Following' },
  { id: 'national', label: 'National' },
  { id: 'state', label: currentUser.state },
]

export default function HomeFeed() {
  const { posts, addPost, following, toggleFollow, setComposerOpen, hidden, blocked, muted } = useApp()
  const [tab, setTab] = useState('foryou')
  const [quick, setQuick] = useState('')

  const feed = posts.filter(p =>
    !hidden.has(p.id) && !blocked.has(p.author) && !muted.has(p.author))
  const visible = tab === 'following'
    ? feed.filter(p => following.has(p.author) || p.author === currentUser.handle)
    : feed

  const submitQuick = () => {
    addPost(quick)
    setQuick('')
  }

  return (
    <div className="feed-layout">
      <section className="feed">
        <div className="tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="composer">
          <div className="avatar">{currentUser.avatar}</div>
          <div className="composer__main">
            <textarea
              placeholder="What's happening in your service year?"
              rows={2}
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
            />
            <div className="composer__row">
              <div className="composer__tools">
                <button className="icon-btn" onClick={() => setComposerOpen(true)}><ImageIcon size={18} /></button>
                <button className="icon-btn" onClick={() => setComposerOpen(true)}><BarChart3 size={18} /></button>
                <button className="icon-btn" onClick={() => setComposerOpen(true)}><MapPin size={18} /></button>
              </div>
              <button className="btn btn--primary" disabled={!quick.trim()} onClick={submitQuick}>Post</button>
            </div>
          </div>
        </div>

        <div className="feed__list">
          {visible.length
            ? visible.map(p => <PostCard key={p.id} post={p} />)
            : <div className="empty">No posts yet — follow people to fill your feed.</div>}
        </div>
      </section>

      <aside className="rail">
        <div className="card">
          <div className="card__title"><TrendingUp size={17} /> Trending</div>
          {trending.map(t => (
            <Link key={t.tag} className="rail-row" to={`/search?q=${encodeURIComponent(t.tag)}`}>
              <span className="rail-row__main">{t.tag}</span>
              <span className="rail-row__sub">{t.posts}</span>
            </Link>
          ))}
        </div>

        <div className="card">
          <div className="card__title">Who to follow</div>
          {suggested.map(handle => {
            const u = users[handle]
            const isFollowing = following.has(handle)
            return (
              <div key={handle} className="follow-row">
                <Link to={`/profile/${handle}`} className="avatar">{u.avatar}</Link>
                <div className="follow-row__info">
                  <Link to={`/profile/${handle}`} className="follow-row__name">{u.name}</Link>
                  <span className="follow-row__sub">{u.handle} · {u.profession}</span>
                </div>
                <button
                  className={`btn btn--sm ${isFollowing ? 'btn--ghost' : 'btn--primary'}`}
                  onClick={() => toggleFollow(handle)}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
