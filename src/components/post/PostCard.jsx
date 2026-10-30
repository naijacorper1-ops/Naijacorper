import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Heart, MessageCircle, Repeat2, Share2, MoreHorizontal,
  Flag, VolumeX, Ban, Trash2, Quote,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api, errorMessage } from '../../lib/api'
import { timeAgo, userTag } from '../../lib/format'
import Avatar, { VerifiedBadge } from '../ui/Avatar'
import ReportModal from '../ui/ReportModal'

// render post text with tappable #hashtags
export function RichText({ text }) {
  const parts = (text || '').split(/(#[\w]+)/g)
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

const isVideo = (url) => /\.(mp4|mov|webm)(\?|$)/i.test(url) || url.includes('/video/upload/')

export function PostMedia({ urls }) {
  if (!urls?.length) return null
  return (
    <div className={`post-media post-media--${Math.min(urls.length, 4)}`} onClick={(e) => e.stopPropagation()}>
      {urls.map(url => isVideo(url)
        ? <video key={url} src={url} controls preload="metadata" />
        : <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="" loading="lazy" /></a>)}
    </div>
  )
}

// A post with no words, media or poll of its own that points at another post.
function isPlainRepost(post) {
  return !!post.repostOf && !post.content && !post.mediaUrls?.length && !post.poll
}

export function Poll({ post, onChange }) {
  const { showToast } = useApp()
  const [busy, setBusy] = useState(false)
  const poll = post.poll
  const showResults = poll.isClosed || !!poll.myOptionId

  const vote = async (optionId) => {
    if (showResults || busy) return
    setBusy(true)
    try {
      const { data } = await api.post(`/posts/${post.id}/poll/vote`, { optionId })
      onChange(data)
      showToast('Vote recorded')
    } catch (err) {
      showToast(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="poll" onClick={(e) => e.stopPropagation()}>
      {poll.options.map((o) => {
        const pct = poll.totalVotes ? Math.round((o.voteCount / poll.totalVotes) * 100) : 0
        return (
          <button
            key={o.id}
            className={`poll__opt ${poll.myOptionId === o.id ? 'poll__opt--mine' : ''}`}
            onClick={() => vote(o.id)}
            disabled={showResults || busy}
          >
            {showResults && <span className="poll__fill" style={{ width: `${pct}%` }} />}
            <span className="poll__label">{o.text}</span>
            {showResults && <span className="poll__pct">{pct}%</span>}
          </button>
        )
      })}
      <span className="poll__meta">
        {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'} · {poll.isClosed ? 'Final results' : `Ends ${timeAgoFuture(poll.expiresAt)}`}
      </span>
    </div>
  )
}

function timeAgoFuture(date) {
  const hours = Math.round((new Date(date).getTime() - Date.now()) / 3600000)
  if (hours < 1) return 'soon'
  if (hours < 24) return `in ${hours}h`
  return `in ${Math.round(hours / 24)}d`
}

export function QuotedPost({ post }) {
  return (
    <Link to={`/post/${post.id}`} className="quoted" onClick={(e) => e.stopPropagation()}>
      <div className="quoted__head">
        <span className="quoted__name">{post.author.fullName}</span>
        <span className="quoted__meta">@{post.author.username} · {timeAgo(post.createdAt)}</span>
      </div>
      {post.content && <p className="quoted__text">{post.content}</p>}
      {post.mediaUrls?.length > 0 && <span className="quoted__meta">📷 {post.mediaUrls.length} attachment{post.mediaUrls.length > 1 ? 's' : ''}</span>}
    </Link>
  )
}

// onRemove(predicate) asks the list to drop posts, e.g. after delete, mute or block.
export default function PostCard({ post: initial, onRemove }) {
  const { me, showToast, openComposer, createPost } = useApp()
  const navigate = useNavigate()
  const [post, setPost] = useState(initial)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const menuRef = useRef(null)

  // The list can hand us a newer copy (e.g. after a comment); start from it.
  const [prevInitial, setPrevInitial] = useState(initial)
  if (initial !== prevInitial) {
    setPrevInitial(initial)
    setPost(initial)
  }

  useEffect(() => {
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    if (menuOpen) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const plain = isPlainRepost(post)
  // For a plain repost we show the original post; actions point at the original.
  const shown = plain ? post.repostOf : post
  const author = shown.author
  const isMine = post.author.id === me.id
  const profileLink = `/profile/${author.username}`

  const openPost = () => navigate(`/post/${shown.id}`)
  const close = () => setMenuOpen(false)

  const toggleLike = async () => {
    const liked = !post.likedByMe
    setPost(p => ({ ...p, likedByMe: liked, likeCount: p.likeCount + (liked ? 1 : -1) }))
    try {
      if (liked) await api.post(`/posts/${post.id}/like`)
      else await api.delete(`/posts/${post.id}/like`)
    } catch (err) {
      setPost(p => ({ ...p, likedByMe: !liked, likeCount: p.likeCount + (liked ? -1 : 1) }))
      showToast(errorMessage(err))
    }
  }

  const repost = async () => {
    try {
      await createPost({ repostOfId: shown.id })
      if (!plain) setPost(p => ({ ...p, repostCount: p.repostCount + 1 }))
      showToast('Reposted')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const quote = () => {
    close()
    openComposer({ quote: shown })
  }

  const share = async () => {
    const url = `${window.location.origin}/post/${shown.id}`
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copied')
    } catch {
      showToast(url)
    }
  }

  const deletePost = async () => {
    close()
    try {
      await api.delete(`/posts/${post.id}`)
      onRemove?.(p => p.id === post.id)
      showToast(plain ? 'Repost removed' : 'Post deleted')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const muteOrBlock = async (action) => {
    close()
    try {
      await api.post(`/users/${post.author.id}/${action}`)
      onRemove?.(p => p.author.id === post.author.id || p.repostOf?.author.id === post.author.id)
      showToast(`${action === 'mute' ? 'Muted' : 'Blocked'} @${post.author.username}`)
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <article className="post">
      <Avatar user={author} to={profileLink} className="post__avatar" onClick={(e) => e.stopPropagation()} />
      <div className="post__body">
        {plain && (
          <Link to={`/profile/${post.author.username}`} className="post__reposted">
            <Repeat2 size={14} /> {isMine ? 'You' : post.author.fullName} reposted
          </Link>
        )}
        <div className="post__head">
          <Link to={profileLink} className="post__name">{author.fullName} <VerifiedBadge user={author} /></Link>
          <span className="post__meta">@{author.username} · {timeAgo(shown.createdAt)}</span>
          {post.group
            ? <Link to={`/community/${post.group.slug}`} className="chip chip--soft">{post.group.name}</Link>
            : userTag(author) && <span className="chip chip--soft">{userTag(author)}</span>}

          <div className="post__menu" ref={menuRef}>
            <button className="icon-btn icon-btn--sm" onClick={() => setMenuOpen(o => !o)} aria-label="More">
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="menu">
                {isMine ? (
                  <button className="menu__item menu__item--danger" onClick={deletePost}>
                    <Trash2 size={15} /> {plain ? 'Undo repost' : 'Delete post'}
                  </button>
                ) : (
                  <>
                    <button className="menu__item" onClick={() => { close(); setReporting(true) }}>
                      <Flag size={15} /> Report post
                    </button>
                    <button className="menu__item" onClick={() => muteOrBlock('mute')}>
                      <VolumeX size={15} /> Mute @{post.author.username}
                    </button>
                    <button className="menu__item menu__item--danger" onClick={() => muteOrBlock('block')}>
                      <Ban size={15} /> Block @{post.author.username}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {shown.content && <p className="post__text" onClick={openPost}><RichText text={shown.content} /></p>}
        <PostMedia urls={shown.mediaUrls} />

        {!plain && post.repostOf && <QuotedPost post={post.repostOf} />}

        {!plain && post.poll && <Poll post={post} onChange={setPost} />}

        <div className="post__actions">
          <button className="act" onClick={openPost}>
            <MessageCircle size={18} /> {plain ? '' : post.commentCount}
          </button>
          <button className="act" onClick={repost} title="Repost">
            <Repeat2 size={18} /> {plain ? '' : post.repostCount}
          </button>
          <button className="act" onClick={quote} title="Quote post">
            <Quote size={17} />
          </button>
          {!plain && (
            <button className={`act ${post.likedByMe ? 'act--liked' : ''}`} onClick={toggleLike}>
              <Heart size={18} fill={post.likedByMe ? 'currentColor' : 'none'} /> {post.likeCount}
            </button>
          )}
          <button className="act" onClick={share} title="Copy link">
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {reporting && (
        <ReportModal
          title="Report post"
          targetType="POST"
          targetId={post.id}
          onClose={() => setReporting(false)}
          onDone={() => onRemove?.(p => p.id === post.id)}
        />
      )}
    </article>
  )
}
