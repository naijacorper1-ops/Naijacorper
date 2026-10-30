import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Image as ImageIcon, BarChart3, TrendingUp } from 'lucide-react'
import PostList from '../../components/post/PostList'
import Avatar from '../../components/ui/Avatar'
import { useApp } from '../../context/AppContext'
import { api, errorMessage } from '../../lib/api'
import usePaged from '../../lib/usePaged'

export default function HomeFeed() {
  const { me, createPost, openComposer, showToast } = useApp()
  const [tab, setTab] = useState('foryou')
  const [quick, setQuick] = useState('')
  const [posting, setPosting] = useState(false)

  const tabs = [
    { id: 'foryou', label: 'For you' },
    { id: 'following', label: 'Following' },
    { id: 'trending', label: 'Trending' },
    ...(me.state ? [{ id: 'state', label: me.state }] : []),
  ]

  const feed = usePaged(async (cursor) => {
    if (tab === 'trending') {
      const { data } = await api.get('/feed/trending')
      return { items: data.posts, nextCursor: null }
    }
    const scope = { foryou: 'NATIONAL', following: 'FOLLOWING', state: 'STATE' }[tab]
    const { data } = await api.get('/feed', { params: { scope, cursor } })
    return { items: data.posts, nextCursor: data.nextCursor }
  }, [tab])

  // New posts (not group posts) belong at the top of every tab but Trending.
  const acceptNew = useCallback((post) => tab !== 'trending' && !post.group, [tab])

  const submitQuick = async () => {
    setPosting(true)
    try {
      await createPost({ content: quick.trim() })
      setQuick('')
      showToast('Post shared 🎉')
    } catch (err) {
      showToast(errorMessage(err))
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="feed-layout">
      <section className="feed">
        <div className="tabs">
          {tabs.map(t => (
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
          <Avatar user={me} />
          <div className="composer__main">
            <textarea
              placeholder="What's happening in your service year?"
              rows={2}
              maxLength={2000}
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
            />
            <div className="composer__row">
              <div className="composer__tools">
                <button className="icon-btn" title="Photo" onClick={() => openComposer()}><ImageIcon size={18} /></button>
                <button className="icon-btn" title="Poll" onClick={() => openComposer()}><BarChart3 size={18} /></button>
              </div>
              <button className="btn btn--primary" disabled={!quick.trim() || posting} onClick={submitQuick}>
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>

        <PostList
          paged={feed}
          acceptNew={acceptNew}
          emptyText={tab === 'following' ? 'No posts yet — follow people to fill your feed.' : 'No posts here yet. Be the first!'}
        />
      </section>

      <aside className="rail">
        <TrendingTags />
      </aside>
    </div>
  )
}

export function TrendingTags({ title = 'Trending' }) {
  const [tags, setTags] = useState(null)

  useEffect(() => {
    api.get('/hashtags/trending')
      .then(({ data }) => setTags(data.hashtags))
      .catch(() => setTags([]))
  }, [])

  return (
    <div className="card">
      <div className="card__title"><TrendingUp size={17} /> {title}</div>
      {tags === null && <span className="rail-row__sub">Loading…</span>}
      {tags?.length === 0 && <span className="rail-row__sub">Nothing trending this week yet. Use #hashtags in your posts!</span>}
      {tags?.map(t => (
        <Link key={t.tag} className="rail-row" to={`/search?q=${encodeURIComponent('#' + t.tag)}`}>
          <span className="rail-row__main">#{t.tag}</span>
          <span className="rail-row__sub">{t.postCount} {t.postCount === 1 ? 'post' : 'posts'}</span>
        </Link>
      ))}
    </div>
  )
}
