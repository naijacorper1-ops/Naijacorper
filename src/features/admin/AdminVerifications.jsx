import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { FileText, Check, X } from 'lucide-react'
import ListState from '../../components/ui/ListState'
import { useApp } from '../../context/AppContext'
import { api, errorMessage } from '../../lib/api'
import usePaged from '../../lib/usePaged'
import { Filters, ReasonDialog, StatusPill } from './adminShared'
import { dateTime, words } from './adminFormat'

// The verification queue: pending requests oldest first. Open the document,
// then approve or reject (a rejection reason is required and the user sees it).
export default function AdminVerifications() {
  const { showToast } = useApp()
  const { reloadStats } = useOutletContext()
  const [status, setStatus] = useState('PENDING')
  const [deciding, setDeciding] = useState(null) // { item, decision }
  const [opening, setOpening] = useState(null)

  const list = usePaged(async (cursor) => {
    const { data } = await api.get('/admin/verifications', { params: { status, cursor } })
    return { items: data.verifications, nextCursor: data.nextCursor }
  }, [status])

  const openDocument = async (item) => {
    // Open the tab first (before the await) so pop-up blockers allow it.
    const tab = window.open('', '_blank')
    setOpening(item.id)
    try {
      const { data } = await api.get(`/admin/verifications/${item.id}/document`)
      if (tab) tab.location.href = data.url
      else window.location.assign(data.url)
    } catch (err) {
      tab?.close()
      showToast(errorMessage(err))
    } finally {
      setOpening(null)
    }
  }

  const decide = async (reason) => {
    const { item, decision } = deciding
    await api.patch(`/admin/verifications/${item.id}/decision`, { decision, reason })
    showToast(decision === 'VERIFIED' ? `@${item.user.username} is now verified` : 'Request rejected')
    if (status === 'PENDING') list.setItems(prev => prev.filter(v => v.id !== item.id))
    else list.setItems(prev => prev.map(v => v.id === item.id ? { ...v, status: decision, hasDocument: false, rejectionReason: decision === 'REJECTED' ? reason : null } : v))
    reloadStats()
  }

  return (
    <div className="admin-panel">
      <Filters selects={[{
        label: 'Status', value: status, onChange: setStatus,
        options: [
          { value: 'PENDING', label: 'Waiting for review' },
          { value: 'VERIFIED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
          { value: 'ALL', label: 'All' },
        ],
      }]} />

      <div className="admin-list">
        {list.items.map(v => (
          <article key={v.id} className="admin-item">
            <div className="admin-item__main">
              <div className="admin-item__title">
                <Link to={`/admin/users?open=${v.user.id}`}>{v.user.fullName}</Link>
                <span className="muted-text">@{v.user.username} · {v.user.email}</span>
                <StatusPill value={v.status} />
              </div>
              <div className="admin-item__meta">
                {words(v.documentType)} · {words(v.user.role)}{v.user.state ? ` · ${v.user.state}` : ''} · sent {dateTime(v.createdAt)}
                {!v.user.emailVerified && ' · email not verified'}
              </div>
              {v.note && <p className="admin-item__note">“{v.note}”</p>}
              {v.rejectionReason && <p className="admin-item__note admin-item__note--bad">Rejected: {v.rejectionReason}</p>}
              {v.reviewedAt && <div className="admin-item__meta">Decided {dateTime(v.reviewedAt)}</div>}
            </div>
            <div className="admin-item__actions">
              {v.hasDocument
                ? <button className="btn btn--ghost btn--sm" onClick={() => openDocument(v)} disabled={opening === v.id}><FileText size={15} /> {opening === v.id ? 'Opening…' : 'View document'}</button>
                : <span className="muted-text">Document deleted</span>}
              {v.status === 'PENDING' && (
                <>
                  <button className="btn btn--primary btn--sm" onClick={() => setDeciding({ item: v, decision: 'VERIFIED' })}><Check size={15} /> Approve</button>
                  <button className="btn btn--danger btn--sm" onClick={() => setDeciding({ item: v, decision: 'REJECTED' })}><X size={15} /> Reject</button>
                </>
              )}
            </div>
          </article>
        ))}
        <ListState
          loading={list.loading} error={list.error} empty={!list.items.length}
          emptyText={status === 'PENDING' ? 'Nothing waiting. The queue is clear. 🎉' : 'No requests here.'}
          hasMore={list.hasMore} onMore={list.loadMore} onRetry={list.reload}
        />
      </div>

      {deciding && (
        <ReasonDialog
          title={deciding.decision === 'VERIFIED' ? 'Approve verification' : 'Reject verification'}
          message={deciding.decision === 'VERIFIED'
            ? `@${deciding.item.user.username} gets the verified badge. The document is deleted after the decision.`
            : `Tell @${deciding.item.user.username} why. They will see this reason.`}
          reasonLabel={deciding.decision === 'VERIFIED' ? 'Note' : 'Reason (the user sees this)'}
          reasonRequired={deciding.decision === 'REJECTED'}
          placeholder={deciding.decision === 'REJECTED' ? 'e.g. The document is blurry, please upload a clearer photo.' : ''}
          confirmLabel={deciding.decision === 'VERIFIED' ? 'Approve' : 'Reject'}
          danger={deciding.decision === 'REJECTED'}
          onConfirm={decide}
          onClose={() => setDeciding(null)}
        />
      )}
    </div>
  )
}
