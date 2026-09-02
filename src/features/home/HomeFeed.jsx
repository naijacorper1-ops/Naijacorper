import { useState } from 'react'
import {
  Heart, MessageCircle, Repeat2, Share2, Bookmark,
  Image as ImageIcon, BarChart3, MapPin, TrendingUp
} from 'lucide-react'

const TABS = [
  { id: 'foryou', label: 'For you' },
  { id: 'following', label: 'Following' },
  { id: 'national', label: 'National' },
  { id: 'state', label: 'Lagos' },
]

const POSTS = [
  {
    id: 1, name: 'David Okafor', handle: '@david_codes', avatar: 'D', time: '2h',
    tag: 'Serving · Lagos',
    text: 'Just arrived in Ibadan today. Anyone serving around Bodija? Looking for affordable accommodation and people to connect with. #CorperLife #CorperInIbadan',
    likes: 42, comments: 12, reposts: 5,
  },
  {
    id: 2, name: 'Amara N.', handle: '@amara_serves', avatar: 'A', time: '5h',
    tag: 'Ex-corper · Oyo',
    text: 'Things I wish I knew before camp: bring extra white socks, a padlock, and small cash. The Mami market will humble you 😅. Ask me anything about Iseyin camp.',
    likes: 128, comments: 34, reposts: 19,
  },
  {
    id: 3, name: 'NYSC Tech Corps', handle: '@nysctech', avatar: 'N', time: '8h',
    tag: 'Community',
    poll: {
      question: "What's been the hardest part of NYSC so far?",
      options: [
        { label: 'Accommodation', pct: 41 },
        { label: 'PPA placement', pct: 27 },
        { label: 'Transport', pct: 18 },
        { label: 'Making friends', pct: 14 },
      ],
      votes: '1,204 votes',
    },
    likes: 76, comments: 41, reposts: 22,
  },
]

const TRENDING = [
  { tag: '#NYSCRelocation', posts: '3,204 posts' },
  { tag: '#CorperInLagos', posts: '1,876 posts' },
  { tag: 'PPA experiences', posts: '980 posts' },
  { tag: 'Ibadan accommodation', posts: '742 posts' },
]

const SUGGESTED = [
  { name: 'Chidi Eze', handle: '@chidi_dev', tag: 'Tech · Lagos', avatar: 'C' },
  { name: 'Fatima B.', handle: '@fatima_b', tag: 'Serving · Kano', avatar: 'F' },
  { name: 'Bright Homes', handle: '@brighthomes', tag: 'Accommodation', avatar: 'B' },
]

function PostCard({ post }) {
  const [liked, setLiked] = useState(false)
  return (
    <article className="post">
      <div className="post__avatar avatar">{post.avatar}</div>
      <div className="post__body">
        <div className="post__head">
          <span className="post__name">{post.name}</span>
          <span className="post__meta">{post.handle} · {post.time}</span>
          <span className="chip chip--soft">{post.tag}</span>
        </div>

        {post.text && <p className="post__text">{post.text}</p>}

        {post.poll && (
          <div className="poll">
            <p className="poll__q">{post.poll.question}</p>
            {post.poll.options.map((o) => (
              <button key={o.label} className="poll__opt">
                <span className="poll__fill" style={{ width: `${o.pct}%` }} />
                <span className="poll__label">{o.label}</span>
                <span className="poll__pct">{o.pct}%</span>
              </button>
            ))}
            <span className="poll__meta">{post.poll.votes}</span>
          </div>
        )}

        <div className="post__actions">
          <button className="act"><MessageCircle size={18} /> {post.comments}</button>
          <button className="act"><Repeat2 size={18} /> {post.reposts}</button>
          <button
            className={`act ${liked ? 'act--liked' : ''}`}
            onClick={() => setLiked(v => !v)}
          >
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} /> {post.likes + (liked ? 1 : 0)}
          </button>
          <button className="act"><Bookmark size={18} /></button>
          <button className="act"><Share2 size={18} /></button>
        </div>
      </div>
    </article>
  )
}

export default function HomeFeed() {
  const [tab, setTab] = useState('foryou')

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
          <div className="avatar">D</div>
          <div className="composer__main">
            <textarea placeholder="What's happening in your service year?" rows={2} />
            <div className="composer__row">
              <div className="composer__tools">
                <button className="icon-btn"><ImageIcon size={18} /></button>
                <button className="icon-btn"><BarChart3 size={18} /></button>
                <button className="icon-btn"><MapPin size={18} /></button>
              </div>
              <button className="btn btn--primary">Post</button>
            </div>
          </div>
        </div>

        <div className="feed__list">
          {POSTS.map(p => <PostCard key={p.id} post={p} />)}
        </div>
      </section>

      <aside className="rail">
        <div className="card">
          <div className="card__title"><TrendingUp size={17} /> Trending</div>
          {TRENDING.map(t => (
            <a key={t.tag} className="rail-row" href="#">
              <span className="rail-row__main">{t.tag}</span>
              <span className="rail-row__sub">{t.posts}</span>
            </a>
          ))}
        </div>

        <div className="card">
          <div className="card__title">Who to follow</div>
          {SUGGESTED.map(s => (
            <div key={s.handle} className="follow-row">
              <div className="avatar">{s.avatar}</div>
              <div className="follow-row__info">
                <span className="follow-row__name">{s.name}</span>
                <span className="follow-row__sub">{s.handle} · {s.tag}</span>
              </div>
              <button className="btn btn--ghost btn--sm">Follow</button>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}