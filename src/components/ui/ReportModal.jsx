import { useState } from 'react'
import Modal from './Modal'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../context/AppContext'

// targetType: POST | USER | COMMENT | LISTING | GROUP
export default function ReportModal({ targetType, targetId, title = 'Report', onClose, onDone }) {
  const { showToast } = useApp()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    setSending(true)
    setError('')
    try {
      await api.post('/reports', { targetType, targetId, reason: reason.trim() })
      showToast("Thanks, we'll review it.")
      onDone?.()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="form-grid form-grid--single">
        <label className="field"><span>What's wrong?</span>
          <textarea
            rows={3}
            maxLength={500}
            placeholder="e.g. Spam, scam, harassment…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row btn-row--end">
        <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" disabled={reason.trim().length < 3 || sending} onClick={submit}>
          {sending ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </Modal>
  )
}
