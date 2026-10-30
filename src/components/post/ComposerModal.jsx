import { useRef, useState } from 'react'
import { Image as ImageIcon, BarChart3, X } from 'lucide-react'
import Modal from '../ui/Modal'
import Avatar from '../ui/Avatar'
import { useApp } from '../../context/AppContext'
import { errorMessage, uploadFile } from '../../lib/api'
import { QuotedPost } from './PostCard'

const MAX_MEDIA = 4

export default function ComposerModal() {
  const { composer } = useApp()
  if (!composer) return null
  // A new key per opening gives the form a clean state each time.
  return <Composer options={composer} />
}

function Composer({ options }) {
  const { me, closeComposer, createPost, showToast } = useApp()
  const quoted = options.quote || null
  const groupId = options.groupId || undefined

  const [text, setText] = useState('')
  const [media, setMedia] = useState([]) // uploaded urls
  const [uploading, setUploading] = useState(0)
  const [showPoll, setShowPoll] = useState(false)
  const [pollOpts, setPollOpts] = useState(['', ''])
  const [pollHours, setPollHours] = useState(24)
  const [error, setError] = useState('')
  const [posting, setPosting] = useState(false)
  const fileInput = useRef(null)

  const updateOpt = (i, v) => setPollOpts(prev => prev.map((o, idx) => idx === i ? v : o))

  const pickFiles = async (e) => {
    const files = [...e.target.files].slice(0, MAX_MEDIA - media.length)
    e.target.value = ''
    setError('')
    for (const file of files) {
      setUploading(n => n + 1)
      try {
        const { url } = await uploadFile('/uploads/post-media', file)
        setMedia(prev => [...prev, url])
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setUploading(n => n - 1)
      }
    }
  }

  const pollReady = !showPoll || pollOpts.filter(o => o.trim()).length >= 2
  const hasSomething = text.trim() || media.length || quoted
  const canPost = hasSomething && pollReady && !uploading && !posting && (!showPoll || text.trim())

  const submit = async () => {
    setPosting(true)
    setError('')
    try {
      await createPost({
        content: text.trim() || undefined,
        mediaUrls: media.length ? media : undefined,
        repostOfId: quoted?.id,
        groupId,
        poll: showPoll
          ? { options: pollOpts.map(o => o.trim()).filter(Boolean), durationHours: Number(pollHours) }
          : undefined,
      })
      showToast(quoted ? 'Quote posted 🎉' : 'Post shared 🎉')
      closeComposer()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPosting(false)
    }
  }

  return (
    <Modal title={quoted ? 'Quote post' : groupId ? 'Post in group' : 'Create post'} onClose={closeComposer}>
      <div className="composer composer--modal">
        <Avatar user={me} />
        <div className="composer__main">
          <textarea
            autoFocus
            rows={quoted ? 3 : 4}
            maxLength={2000}
            placeholder={showPoll ? 'Ask a question…' : quoted ? 'Add a comment…' : "What's happening in your service year?"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {quoted && <div className="quoted--compose"><QuotedPost post={quoted} /></div>}

          {(media.length > 0 || uploading > 0) && (
            <div className="compose-media">
              {media.map(url => (
                <div key={url} className="compose-media__item">
                  {/\.(mp4|mov|webm)$/i.test(url) || url.includes('/video/upload/')
                    ? <video src={url} />
                    : <img src={url} alt="" />}
                  <button className="compose-media__remove" onClick={() => setMedia(prev => prev.filter(u => u !== url))} aria-label="Remove">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {uploading > 0 && <div className="compose-media__item compose-media__item--loading">Uploading…</div>}
            </div>
          )}

          {showPoll && (
            <div className="poll-compose">
              {pollOpts.map((o, i) => (
                <div key={i} className="poll-compose__row">
                  <input
                    placeholder={`Option ${i + 1}`}
                    maxLength={80}
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
              <div className="poll-compose__row">
                {pollOpts.length < 4 && (
                  <button className="btn btn--ghost btn--sm" onClick={() => setPollOpts(prev => [...prev, ''])}>
                    + Add option
                  </button>
                )}
                <select className="poll-compose__len" value={pollHours} onChange={(e) => setPollHours(e.target.value)}>
                  <option value={1}>1 hour</option>
                  <option value={6}>6 hours</option>
                  <option value={24}>1 day</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
              </div>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="composer__row">
            <div className="composer__tools">
              <button
                className="icon-btn"
                title="Photo or video"
                disabled={media.length + uploading >= MAX_MEDIA}
                onClick={() => fileInput.current?.click()}
              >
                <ImageIcon size={18} />
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
                multiple
                hidden
                onChange={pickFiles}
              />
              {!quoted && (
                <button className={`icon-btn ${showPoll ? 'icon-btn--on' : ''}`} title="Poll" onClick={() => setShowPoll(v => !v)}>
                  <BarChart3 size={18} />
                </button>
              )}
            </div>
            <button className="btn btn--primary" disabled={!canPost} onClick={submit}>
              {posting ? 'Posting…' : quoted ? 'Quote' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
