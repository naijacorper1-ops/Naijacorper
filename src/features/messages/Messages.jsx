import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Send, Search } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { useApp } from '../../context/AppContext'
import { api, errorMessage } from '../../lib/api'
import { clockTime, timeAgo } from '../../lib/format'
import { sendMessageRealtime } from '../../lib/socket'

// New messages arrive instantly over Socket.IO (`newMessage`). While the
// socket is disconnected the screen falls back to fetching every few seconds,
// and it fetches once more when the socket comes back to catch up.
const THREAD_POLL_MS = Number(import.meta.env.VITE_POLLING_FALLBACK_MS) || 5000
const INBOX_POLL_MS = 15000

// Oldest first, no duplicates.
function mergeMessages(prev, added) {
  if (!added.length) return prev
  return [...prev, ...added].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
}

export default function Messages() {
  const { me, refreshUnread, realtime, onNewMessage } = useApp()
  const [params, setParams] = useSearchParams()
  const activeId = params.get('c')

  const [convos, setConvos] = useState([])
  const [convosCursor, setConvosCursor] = useState(null)
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState('')
  const [filter, setFilter] = useState('')

  const loadInbox = useCallback(() => api.get('/messaging/conversations')
    .then(({ data }) => {
      // Keep any older pages already loaded below the first page.
      setConvos(prev => {
        const fresh = new Set(data.conversations.map(c => c.id))
        return [...data.conversations, ...prev.filter(c => !fresh.has(c.id))]
      })
      setConvosCursor(prev => prev ?? data.nextCursor)
      setListError('')
    })
    .catch(err => setListError(errorMessage(err)))
    .then(() => setLoadingList(false)), [])

  // Load now, and again whenever the socket goes up or down. Keep polling only
  // while it is down.
  useEffect(() => {
    loadInbox()
    if (realtime) return undefined
    const timer = setInterval(loadInbox, INBOX_POLL_MS)
    return () => clearInterval(timer)
  }, [loadInbox, realtime])

  // Only mention a lost connection if it lasts; connecting takes a moment.
  const [offlineNotice, setOfflineNotice] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setOfflineNotice(!realtime), realtime ? 0 : 4000)
    return () => clearTimeout(t)
  }, [realtime])

  // Live: move the conversation to the top with its new last message.
  const convosRef = useRef(convos)
  const activeIdRef = useRef(activeId)
  useEffect(() => { convosRef.current = convos; activeIdRef.current = activeId })
  useEffect(() => onNewMessage((m) => {
    if (!convosRef.current.some(c => c.id === m.conversationId)) {
      loadInbox() // a brand-new conversation
      return
    }
    const fromOther = m.senderId !== me.id
    setConvos(prev => prev
      .map(c => c.id === m.conversationId
        ? {
          ...c,
          lastMessage: m,
          lastMessageAt: m.createdAt,
          unreadCount: fromOther && c.id !== activeIdRef.current ? (c.unreadCount ?? 0) + 1 : c.unreadCount,
        }
        : c)
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)))
  }), [onNewMessage, loadInbox, me.id])

  const loadOlderConvos = async () => {
    const { data } = await api.get('/messaging/conversations', { params: { cursor: convosCursor } })
    setConvos(prev => [...prev, ...data.conversations.filter(c => !prev.some(p => p.id === c.id))])
    setConvosCursor(data.nextCursor)
  }

  const active = convos.find(c => c.id === activeId)
  const shown = convos.filter(c => {
    const q = filter.trim().toLowerCase()
    if (!q) return true
    const u = c.otherParticipant
    return u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
  })

  const onRead = useCallback((conversationId) => {
    setConvos(prev => prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c))
    refreshUnread()
  }, [refreshUnread])

  const onSent = useCallback((conversationId, message) => {
    setConvos(prev => {
      const updated = prev.map(c => c.id === conversationId
        ? { ...c, lastMessage: message, lastMessageAt: message.createdAt }
        : c)
      return updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
    })
  }, [])

  return (
    <div className={`messages ${activeId ? 'messages--thread-open' : ''}`}>
      <aside className="msg-list">
        <div className="msg-list__head">
          <h1 className="page__title">Messages</h1>
          {!realtime && offlineNotice && <p className="msg-offline">Reconnecting… new messages may take a few seconds.</p>}
          <label className="msg-search"><Search size={15} />
            <input placeholder="Search conversations" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </label>
        </div>
        {loadingList && <div className="empty">Loading…</div>}
        {listError && <div className="empty">{listError}</div>}
        {!loadingList && !listError && convos.length === 0 && (
          <div className="empty">No conversations yet. Open someone's profile and tap Message.</div>
        )}
        {shown.map(c => {
          const u = c.otherParticipant
          const last = c.lastMessage
          return (
            <button
              key={c.id}
              className={`msg-item ${c.id === activeId ? 'msg-item--active' : ''}`}
              onClick={() => setParams({ c: c.id })}
            >
              <Avatar user={u} />
              <div className="msg-item__info">
                <span className="msg-item__name">{u.fullName}</span>
                <span className="msg-item__last">
                  {last ? `${last.senderId === me.id ? 'You: ' : ''}${last.content}` : 'Say hello 👋'}
                </span>
              </div>
              <div className="msg-item__meta">
                <span className="msg-item__time">{timeAgo(c.lastMessageAt)}</span>
                {c.unreadCount > 0 && <span className="msg-item__dot" />}
              </div>
            </button>
          )
        })}
        {convosCursor && !filter && (
          <div className="load-more"><button className="btn btn--ghost btn--sm" onClick={loadOlderConvos}>Load more</button></div>
        )}
      </aside>

      <section className="msg-thread">
        {active
          ? <Thread key={active.id} conversation={active} onRead={onRead} onSent={onSent} onBack={() => setParams({})} />
          : <div className="empty">{activeId && !loadingList ? 'Conversation not found.' : 'Select a conversation.'}</div>}
      </section>
    </div>
  )
}

function Thread({ conversation, onRead, onSent, onBack }) {
  const { me, showToast, realtime, onNewMessage } = useApp()
  const other = conversation.otherParticipant
  const [messages, setMessages] = useState([]) // oldest first
  const [olderCursor, setOlderCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const stickToBottom = useRef(true)
  const seen = useRef(new Set()) // ids already on screen

  // Adds messages not on screen yet; returns the ones that were new.
  const addMessages = useCallback((list) => {
    const added = list.filter(m => !seen.current.has(m.id))
    added.forEach(m => seen.current.add(m.id))
    if (added.length) setMessages(prev => mergeMessages(prev, added))
    return added
  }, [])

  const markRead = useCallback(async () => {
    try {
      await api.patch(`/messaging/conversations/${conversation.id}/read`)
      onRead(conversation.id)
    } catch { /* not important */ }
  }, [conversation.id, onRead])

  // Newest page; merges with what is already on screen. Returns what was new.
  const refresh = useCallback(async (first = false) => {
    try {
      const { data } = await api.get(`/messaging/conversations/${conversation.id}/messages`)
      const added = addMessages(data.messages)
      if (first) setOlderCursor(data.nextCursor)
      if (first || added.some(m => m.senderId !== me.id)) markRead()
      return added
    } catch (err) {
      if (first) showToast(errorMessage(err))
      return []
    } finally {
      if (first) setLoading(false)
    }
  }, [conversation.id, me.id, addMessages, markRead, showToast])

  // First load, then: poll only while the socket is down, and catch up once
  // when it comes back.
  const firstLoad = useRef(true)
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false
      refresh(true)
    } else if (realtime) {
      const t = setTimeout(() => refresh(false), 0)
      return () => clearTimeout(t)
    }
    if (realtime) return undefined
    const timer = setInterval(() => refresh(false), THREAD_POLL_MS)
    return () => clearInterval(timer)
  }, [realtime, refresh])

  // Live messages for this conversation.
  useEffect(() => onNewMessage((m) => {
    if (m.conversationId !== conversation.id) return
    const added = addMessages([m])
    if (added.length && m.senderId !== me.id) markRead()
  }), [onNewMessage, conversation.id, me.id, addMessages, markRead])

  useEffect(() => {
    if (stickToBottom.current) bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const loadOlder = async () => {
    stickToBottom.current = false
    const { data } = await api.get(`/messaging/conversations/${conversation.id}/messages`, { params: { cursor: olderCursor } })
    addMessages(data.messages)
    setOlderCursor(data.nextCursor)
  }

  const sendOverRest = async (content) => {
    const { data } = await api.post(`/messaging/conversations/${conversation.id}/messages`, { content })
    return data
  }

  const send = async () => {
    const content = text.trim()
    if (!content) return
    setSending(true)
    stickToBottom.current = true
    try {
      let saved
      try {
        // The acknowledgement carries the saved message.
        saved = await sendMessageRealtime(conversation.id, content)
      } catch (err) {
        if (err.code === 'NOT_CONNECTED') {
          // Nothing went out over the socket, so REST is safe.
          saved = await sendOverRest(content)
        } else if (err.code === 'UNCONFIRMED') {
          // It may have been saved. Check before asking the user to resend,
          // so we never post it twice.
          const landed = (await refresh(false)).find(m => m.senderId === me.id && m.content === content)
          if (!landed) throw err
          saved = landed
        } else {
          throw err
        }
      }
      addMessages([saved])
      setText('')
      onSent(conversation.id, saved)
    } catch (err) {
      showToast(err.isSocketError
        ? (err.code === 'UNCONFIRMED' ? 'Message may not have been sent. Please try again.' : err.message)
        : errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="msg-thread__head">
        <button className="link-btn msg-thread__back" onClick={onBack}>←</button>
        <Avatar user={other} to={`/profile/${other.username}`} />
        <div>
          <Link to={`/profile/${other.username}`} className="msg-thread__name">{other.fullName}</Link>
          <span className="msg-thread__sub">@{other.username}</span>
        </div>
      </div>

      <div className="msg-thread__body" onScroll={(e) => {
        const el = e.currentTarget
        stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      }}>
        {olderCursor && (
          <div className="load-more"><button className="btn btn--ghost btn--sm" onClick={loadOlder}>Load older messages</button></div>
        )}
        {loading && <div className="empty">Loading…</div>}
        {!loading && messages.length === 0 && <div className="empty">No messages yet. Say hello 👋</div>}
        {messages.map(m => (
          <div key={m.id} className={`bubble bubble--${m.senderId === me.id ? 'me' : 'bot'}`}>
            {m.content}
            <span className="bubble__time">{clockTime(m.createdAt)}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="msg-thread__input">
        <input
          placeholder="Type a message…"
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !sending && send()}
        />
        <button className="btn btn--primary btn--sm" onClick={send} disabled={sending || !text.trim()} aria-label="Send"><Send size={16} /></button>
      </div>
    </>
  )
}
