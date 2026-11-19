import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import { errorMessage } from '../../lib/api'
import { words } from './adminFormat'

// Small helpers shared by the admin screens.

export function StatusPill({ value }) {
  const tone = {
    PENDING: 'warn', AVAILABLE: 'ok', VERIFIED: 'ok', REVIEWED: 'ok', active: 'ok',
    REJECTED: 'bad', REMOVED: 'bad', inactive: 'bad', DISMISSED: 'muted', SOLD: 'muted', UNVERIFIED: 'muted',
  }[value] || 'muted'
  return <span className={`pill pill--${tone}`}>{words(value)}</span>
}

// Confirmation dialog with an optional or required reason. `onConfirm(reason)`
// may throw; the error is shown in the dialog and it stays open.
export function ReasonDialog({
  title, message, confirmLabel = 'Confirm', danger = false,
  reasonLabel = 'Reason (saved in the audit log)', reasonRequired = false, minLength = 0,
  placeholder = '', onConfirm, onClose, children,
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const trimmed = reason.trim()
  const valid = !reasonRequired || trimmed.length >= Math.max(1, minLength)

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await onConfirm(trimmed || undefined)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}>
      {message && <p className="admin-dialog__msg">{message}</p>}
      {children}
      <div className="form-grid form-grid--single">
        <label className="field"><span>{reasonLabel}{reasonRequired ? '' : ' (optional)'}</span>
          <textarea rows={3} maxLength={500} placeholder={placeholder} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row btn-row--end">
        <button className="btn btn--ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} disabled={!valid || busy} onClick={submit}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// Filter bar with a search box and any number of selects.
export function Filters({ q, onQ, placeholder = 'Search', selects = [] }) {
  return (
    <div className="admin-filters">
      {onQ && (
        <input className="admin-input" placeholder={placeholder} maxLength={80} value={q} onChange={(e) => onQ(e.target.value)} />
      )}
      {selects.map(s => (
        <select key={s.label} className="admin-input admin-select" value={s.value} onChange={(e) => s.onChange(e.target.value)} aria-label={s.label}>
          {s.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
    </div>
  )
}
