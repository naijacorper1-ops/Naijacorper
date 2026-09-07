import { useState } from 'react'
import { Image as ImageIcon, BarChart3, MapPin, Smile, X } from 'lucide-react'
import Modal from '../ui/Modal'
import { useApp } from '../../context/AppContext'
import { currentUser, users } from '../../data/mock'

export default function ComposerModal() {
  const { composerOpen, setComposerOpen, addPost, posts } = useApp()
  const [text, setText] = useState('')
  const [showPoll, setShowPoll] = useState(false)
  const [pollOpts, setPollOpts] = useState(['', ''])

  if (!composerOpen) return null

  const quoteId = window.__quoteId || null
  const quoted = quoteId ? posts.find(p => p.id === quoteId) : null

  const reset = () => {
    setText(''); setShowPoll(false); setPollOpts(['', ''])
    window.__quoteId = null
    setComposerOpen(false)
  }

  const submit = () => {
    addPost(text, quoteId)
    reset()
  }

  const updateOpt = (i, v) => setPollOpts(prev => prev.map((o, idx) => idx === i ? v : o))

  return (
    <Modal title={quoted ? 'Quote post' : 'Create post'} onClose={reset}>
      <div className="composer composer--modal">
        <div className="avatar">{currentUser.avatar}</div>
        <div className="composer__main">
          <textarea
            autoFocus
            rows={quoted ? 3 : 4}
            placeholder={quoted ? 'Add a comment…' : "What's happening in your service year?"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {quoted && (
            <div className="quoted quoted--compose">
              <div className="quoted__head">
                <span className="quoted__name">{(users[quoted.author] || {}).name || quoted.author}</span>
                <span className="quoted__meta">{quoted.author} · {quoted.time}</span>
              </div>
              <p className="quoted__text">{quoted.text}</p>
            </div>
          )}

          {showPoll && (
            <div className="poll-compose">
              {pollOpts.map((o, i) => (
                <div key={i} className="poll-compose__row">
                  <input
                    placeholder={`Option ${i + 1}`}
                    value={o}
                    onChange={(e) => updateOpt(i, e.target.value)}
                  />
                  {pollOpts.length > 2 && (
                    <button className="icon-btn icon-btn--sm" onClick={() => setPollOpts(prev => prev.filter((_, idx) => idx !== i))}>
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
              {pollOpts.length < 4 && (
                <button className="btn btn--ghost btn--sm" onClick={() => setPollOpts(prev => [...prev, ''])}>
                  + Add option
                </button>
              )}
            </div>
          )}

          <div className="composer__row">
            <div className="composer__tools">
              <button className="icon-btn" title="Photo"><ImageIcon size={18} /></button>
              <button className={`icon-btn ${showPoll ? 'icon-btn--on' : ''}`} title="Poll" onClick={() => setShowPoll(v => !v)}>
                <BarChart3 size={18} />
              </button>
              <button className="icon-btn" title="Location"><MapPin size={18} /></button>
              <button className="icon-btn" title="Emoji"><Smile size={18} /></button>
            </div>
            <button className="btn btn--primary" disabled={!text.trim()} onClick={submit}>
              {quoted ? 'Quote' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
