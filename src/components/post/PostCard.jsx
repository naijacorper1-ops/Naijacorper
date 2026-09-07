import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Heart, MessageCircle, Repeat2, Share2, Bookmark, MoreHorizontal,
  Flag, VolumeX, Ban, Trash2, Quote,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { users, currentUser } from '../../data/mock'

// render post text with tappable #hashtags
export function RichText({ text }) {
  const parts = text.split(/(#[\w]+)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('#')
          ? <Link key={i} to={`/search?q=${encodeURIComponent(part)}`} className="hashtag" onClick={(e) => e.stopPropagation()}>{part}</Link>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

export default function PostCard({ post }) {
  const {
    posts, likes, toggleLike, saved, toggleSave, reposted, toggleRepost,
    showToast, deletePost, hidePost, toggleMute, toggleBlock, muted, blocked, setComposerOpen,
  } = useApp()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const author = users[post.author] || { name: post.author, avatar: '?', handle: post.author }
  const isMine = post.author === currentUser.handle
  const quoted = post.quotedId ? posts.find(p => p.id === post.quotedId) : null

  const liked = likes.has(post.id)
  const isSaved = saved.has(post.id)
  const isReposted = reposted.has(post.id)

  useEffect(() => {
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    if (menuOpen) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const openPost = () => navigate(`/post/${post.id}`)
  const close = () => setMenuOpen(false)

  const quotePost = () => {
    close()
    // stash quoted id for the composer via a lightweight event
    window.__quoteId = post.id
    setComposerOpen(true)
  }

  return (
    <article className="post">
      <Link to={`/profile/${author.handle}`} className="post__avatar avatar" onClick={(e) => e.stopPropagation()}>
        {author.avatar}
      </Link>
      <div className="post__body">
        <div className="post__head">
          <Link to={`/profile/${author.handle}`} className="post__name">{author.name}</Link>
          <span className="post__meta">{author.handle} · {post.time}</span>
          {post.tag && <span className="chip chip--soft">{post.tag}</span>}

          <div className="post__menu" ref={menuRef}>
            <button className="icon-btn icon-btn--sm" onClick={() => setMenuOpen(o => !o)} aria-label="More">
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="menu">
                {isMine ? (
                  <button className="menu__item menu__item--danger" onClick={() => { deletePost(post.id); close() }}>
                    <Trash2 size={15} /> Delete post
                  </button>
                ) : (
                  <>
                    <button className="menu__item" onClick={() => { hidePost(post.id); close() }}>
                      <Flag size={15} /> Report post
                    </button>
                    <button className="menu__item" onClick={() => { toggleMute(post.author); close() }}>
                      <VolumeX size={15} /> {muted.has(post.author) ? 'Unmute' : 'Mute'} {author.handle}
                    </button>
                    <button className="menu__item menu__item--danger" onClick={() => { toggleBlock(post.author); close() }}>
                      <Ban size={15} /> {blocked.has(post.author) ? 'Unblock' : 'Block'} {author.handle}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {post.text && <p className="post__text" onClick={openPost}><RichText text={post.text} /></p>}

        {quoted && (
          <Link to={`/post/${quoted.id}`} className="quoted" onClick={(e) => e.stopPropagation()}>
            <div className="quoted__head">
              <span className="quoted__name">{(users[quoted.author] || {}).name || quoted.author}</span>
              <span className="quoted__meta">{quoted.author} · {quoted.time}</span>
            </div>
            <p className="quoted__text">{quoted.text}</p>
          </Link>
        )}

        {post.poll && (
          <div className="poll">
            <p className="poll__q">{post.poll.question}</p>
            {post.poll.options.map((o) => (
              <button key={o.label} className="poll__opt" onClick={() => showToast('Vote recorded')}>
                <span className="poll__fill" style={{ width: `${o.pct}%` }} />
                <span className="poll__label">{o.label}</span>
                <span className="poll__pct">{o.pct}%</span>
              </button>
            ))}
            <span className="poll__meta">{post.poll.votes}</span>
          </div>
        )}

        <div className="post__actions">
          <button className="act" onClick={openPost}>
            <MessageCircle size={18} /> {post.comments}
          </button>
          <button className={`act ${isReposted ? 'act--reposted' : ''}`} onClick={() => toggleRepost(post.id)}>
            <Repeat2 size={18} /> {post.reposts + (isReposted ? 1 : 0)}
          </button>
          <button className="act" onClick={quotePost} title="Quote post">
            <Quote size={17} />
          </button>
          <button className={`act ${liked ? 'act--liked' : ''}`} onClick={() => toggleLike(post.id)}>
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} /> {post.likes + (liked ? 1 : 0)}
          </button>
          <button className={`act ${isSaved ? 'act--saved' : ''}`} onClick={() => toggleSave(post.id)}>
            <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
          <button className="act" onClick={() => showToast('Link copied')}>
            <Share2 size={18} />
          </button>
        </div>
      </div>
    </article>
  )
}
