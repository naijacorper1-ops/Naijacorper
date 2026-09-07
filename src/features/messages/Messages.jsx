import { useState } from 'react'
import { Send, Search } from 'lucide-react'
import { conversations as seed, users } from '../../data/mock'

export default function Messages() {
  const [convos, setConvos] = useState(seed)
  const [activeId, setActiveId] = useState(seed[0]?.id)
  const [text, setText] = useState('')

  const active = convos.find(c => c.id === activeId)

  const send = () => {
    if (!text.trim()) return
    setConvos(prev => prev.map(c =>
      c.id === activeId
        ? { ...c, last: text.trim(), time: 'now', unread: false,
            messages: [...c.messages, { from: 'me', text: text.trim(), time: 'now' }] }
        : c
    ))
    setText('')
  }

  return (
    <div className="messages">
      <aside className="msg-list">
        <div className="msg-list__head">
          <h1 className="page__title">Messages</h1>
          <label className="msg-search"><Search size={15} /><input placeholder="Search messages" /></label>
        </div>
        {convos.map(c => {
          const u = users[c.handle] || { name: c.handle, avatar: '?' }
          return (
            <button
              key={c.id}
              className={`msg-item ${c.id === activeId ? 'msg-item--active' : ''}`}
              onClick={() => setActiveId(c.id)}
            >
              <div className="avatar">{u.avatar}</div>
              <div className="msg-item__info">
                <span className="msg-item__name">{u.name}</span>
                <span className="msg-item__last">{c.last}</span>
              </div>
              <div className="msg-item__meta">
                <span className="msg-item__time">{c.time}</span>
                {c.unread && <span className="msg-item__dot" />}
              </div>
            </button>
          )
        })}
      </aside>

      <section className="msg-thread">
        {active ? (
          <>
            <div className="msg-thread__head">
              <div className="avatar">{(users[active.handle] || {}).avatar || '?'}</div>
              <div>
                <span className="msg-thread__name">{(users[active.handle] || {}).name || active.handle}</span>
                <span className="msg-thread__sub">{active.handle}</span>
              </div>
            </div>

            <div className="msg-thread__body">
              {active.messages.map((m, i) => (
                <div key={i} className={`bubble bubble--${m.from === 'me' ? 'me' : 'bot'}`}>
                  {m.text}
                  <span className="bubble__time">{m.time}</span>
                </div>
              ))}
            </div>

            <div className="msg-thread__input">
              <input
                placeholder="Type a message…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
              />
              <button className="btn btn--primary btn--sm" onClick={send} aria-label="Send"><Send size={16} /></button>
            </div>
          </>
        ) : (
          <div className="empty">Select a conversation.</div>
        )}
      </section>
    </div>
  )
}
