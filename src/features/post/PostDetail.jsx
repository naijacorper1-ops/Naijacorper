import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Trash2, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import PostCard from '../../components/post/PostCard'
import Avatar, { VerifiedBadge } from '../../components/ui/Avatar'
import ListState from '../../components/ui/ListState'
import { api, errorMessage } from '../../lib/api'
import { timeAgo } from '../../lib/format'
import usePaged from '../../lib/usePaged'

// A new id gives a fresh page (keyed), so nothing from the last post lingers.
export default function PostDetail() {
  const { id } = useParams()
  return <PostPage key={id} id={id} />
}

function PostPage({ id }) {
  const navigate = useNavigate()
  const { me, showToast } = useApp()

  const [post, setPost] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null) // a top-level comment
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get(`/posts/${id}`)
      .then(({ data }) => { if (!cancelled) setPost(data) })
      .catch(err => { if (!cancelled) setLoadError(errorMessage(err)) })
    return () => { cancelled = true }
  }, [id])

  const comments = usePaged(async (cursor) => {
    const { data } = await api.get(`/posts/${id}/comments`, { params: { cursor } })
    return { items: data.comments, nextCursor: data.nextCursor }
  }, [id])

  const addComment = async () => {
    if (!text.trim()) return
    setSending(true)
    try {
      const { data } = await api.post(`/posts/${id}/comments`, {
        content: text.trim(),
        parentId: replyTo?.id,
      })
      if (replyTo) {
        comments.setItems(prev => prev.map(c => c.id === replyTo.id
          ? { ...c, replies: [...c.replies, data], replyCount: c.replyCount + 1 }
          : c))
      } else {
        comments.setItems(prev => [...prev, data])
      }
      setPost(p => p && { ...p, commentCount: p.commentCount + 1 })
      setText('')
      setReplyTo(null)
      showToast('Reply posted')
    } catch (err) {
      showToast(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const deleteComment = async (comment, parentId) => {
    try {
      await api.delete(`/posts/${id}/comments/${comment.id}`)
      if (parentId) {
        comments.setItems(prev => prev.map(c => c.id === parentId
          ? { ...c, replies: c.replies.filter(r => r.id !== comment.id), replyCount: c.replyCount - 1 }
          : c))
        setPost(p => p && { ...p, commentCount: p.commentCount - 1 })
      } else {
        comments.setItems(prev => prev.filter(c => c.id !== comment.id))
        setPost(p => p && { ...p, commentCount: p.commentCount - 1 - (comment.replyCount || 0) })
      }
      showToast('Comment deleted')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const loadAllReplies = async (comment) => {
    try {
      let cursor
      let all = []
      do {
        const { data } = await api.get(`/posts/${id}/comments/${comment.id}/replies`, { params: { cursor, pageSize: 50 } })
        all = [...all, ...data.comments]
        cursor = data.nextCursor
      } while (cursor)
      comments.setItems(prev => prev.map(c => c.id === comment.id ? { ...c, replies: all } : c))
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <div className="page">
      <div className="detail-top">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="detail-title">Post</h1>
      </div>

      {loadError && <div className="empty">{loadError}</div>}
      {!post && !loadError && <div className="empty">Loading…</div>}

      {post && (
        <>
          <PostCard post={post} onRemove={() => navigate(-1)} />

          <div className="reply-box">
            <Avatar user={me} />
            <div className="reply-box__main">
              {replyTo && (
                <span className="reply-box__to">
                  Replying to @{replyTo.author.username}
                  <button className="link-btn" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X size={13} /></button>
                </span>
              )}
              <input
                placeholder={replyTo ? 'Write your reply' : 'Post your reply'}
                maxLength={1000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addComment()}
              />
            </div>
            <button className="btn btn--primary btn--sm" disabled={!text.trim() || sending} onClick={addComment}>Reply</button>
          </div>

          <div className="feed__list">
            {comments.items.map(c => (
              <div key={c.id}>
                <Comment
                  comment={c}
                  mine={c.author.id === me.id}
                  onReply={() => { setReplyTo(c); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  onDelete={() => deleteComment(c)}
                />
                <div className="comment-replies">
                  {c.replies.map(r => (
                    <Comment
                      key={r.id}
                      comment={r}
                      mine={r.author.id === me.id}
                      onReply={() => setReplyTo(c)}
                      onDelete={() => deleteComment(r, c.id)}
                    />
                  ))}
                  {c.replyCount > c.replies.length && (
                    <button className="link-btn comment-replies__more" onClick={() => loadAllReplies(c)}>
                      View {c.replyCount - c.replies.length} more {c.replyCount - c.replies.length === 1 ? 'reply' : 'replies'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <ListState
              loading={comments.loading}
              error={comments.error}
              empty={!comments.items.length}
              emptyText="No replies yet. Be the first."
              hasMore={comments.hasMore}
              onMore={comments.loadMore}
              onRetry={comments.reload}
            />
          </div>
        </>
      )}
    </div>
  )
}

function Comment({ comment, mine, onReply, onDelete }) {
  const u = comment.author
  return (
    <article className="post">
      <Avatar user={u} to={`/profile/${u.username}`} className="post__avatar" />
      <div className="post__body">
        <div className="post__head">
          <Link to={`/profile/${u.username}`} className="post__name">{u.fullName} <VerifiedBadge user={u} /></Link>
          <span className="post__meta">@{u.username} · {timeAgo(comment.createdAt)}</span>
        </div>
        <p className="post__text">{comment.content}</p>
        <div className="post__actions">
          <button className="act" onClick={onReply}>Reply</button>
          {mine && <button className="act" onClick={onDelete}><Trash2 size={15} /> Delete</button>}
        </div>
      </div>
    </article>
  )
}
