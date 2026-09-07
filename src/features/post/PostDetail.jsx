import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Heart, MessageCircle, Repeat2, Share2, Bookmark,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { RichText } from '../../components/post/PostCard'
import { comments as seedComments, users, currentUser } from '../../data/mock'

export default function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { posts, likes, toggleLike, saved, toggleSave, reposted, toggleRepost, showToast } = useApp()

  const post = posts.find(p => String(p.id) === id)
  const [replies, setReplies] = useState(seedComments[id] || [])
  const [text, setText] = useState('')

  if (!post) {
    return (
      <div className="page">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}><ArrowLeft size={15} /> Back</button>
        <div className="empty">Post not found.</div>
      </div>
    )
  }

  const author = users[post.author] || { name: post.author, avatar: '?' }
  const liked = likes.has(post.id)
  const isSaved = saved.has(post.id)
  const isReposted = reposted.has(post.id)

  const addReply = () => {
    if (!text.trim()) return
    setReplies(prev => [...prev, { author: currentUser.handle, time: 'now', text: text.trim() }])
    setText('')
    showToast('Reply posted')
  }

  return (
    <div className="page">
      <div className="detail-top">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="detail-title">Post</h1>
      </div>

      <article className="post post--detail">
        <Link to={`/profile/${author.handle}`} className="post__avatar avatar">{author.avatar}</Link>
        <div className="post__body">
          <div className="post__head">
            <Link to={`/profile/${author.handle}`} className="post__name">{author.name}</Link>
            <span className="post__meta">{author.handle} · {post.time}</span>
            {post.tag && <span className="chip chip--soft">{post.tag}</span>}
          </div>
          {post.text && <p className="post__text post__text--lg"><RichText text={post.text} /></p>}

          <div className="post__actions post__actions--detail">
            <button className="act"><MessageCircle size={18} /> {replies.length}</button>
            <button className={`act ${isReposted ? 'act--reposted' : ''}`} onClick={() => toggleRepost(post.id)}>
              <Repeat2 size={18} /> {post.reposts + (isReposted ? 1 : 0)}
            </button>
            <button className={`act ${liked ? 'act--liked' : ''}`} onClick={() => toggleLike(post.id)}>
              <Heart size={18} fill={liked ? 'currentColor' : 'none'} /> {post.likes + (liked ? 1 : 0)}
            </button>
            <button className={`act ${isSaved ? 'act--saved' : ''}`} onClick={() => toggleSave(post.id)}>
              <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
            </button>
            <button className="act" onClick={() => showToast('Link copied')}><Share2 size={18} /></button>
          </div>
        </div>
      </article>

      <div className="reply-box">
        <div className="avatar">{currentUser.avatar}</div>
        <input
          placeholder="Post your reply"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addReply()}
        />
        <button className="btn btn--primary btn--sm" disabled={!text.trim()} onClick={addReply}>Reply</button>
      </div>

      <div className="feed__list">
        {replies.map((c, i) => {
          const u = users[c.author] || { name: c.author, avatar: '?', handle: c.author }
          return (
            <article key={i} className="post">
              <Link to={`/profile/${u.handle}`} className="post__avatar avatar">{u.avatar}</Link>
              <div className="post__body">
                <div className="post__head">
                  <span className="post__name">{u.name}</span>
                  <span className="post__meta">{u.handle} · {c.time}</span>
                </div>
                <p className="post__text">{c.text}</p>
              </div>
            </article>
          )
        })}
        {replies.length === 0 && <div className="empty">No replies yet. Be the first.</div>}
      </div>
    </div>
  )
}
