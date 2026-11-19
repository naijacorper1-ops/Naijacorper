import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import ListState from '../../components/ui/ListState'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { naira } from '../../lib/format'
import usePaged from '../../lib/usePaged'
import { Filters, ReasonDialog, StatusPill } from './adminShared'
import { dateTime, words } from './adminFormat'

const TARGETS = ['POST', 'USER', 'COMMENT', 'LISTING', 'GROUP']

// What was reported. Uses the live item when it still exists, otherwise the
// copy taken when the report was filed.
function ReportedContent({ report }) {
  const t = report.target
  const snap = report.snapshot || {}
  const gone = !report.targetExists

  let body
  switch (report.targetType) {
    case 'POST':
      body = (
        <>
          {t?.author && <div className="admin-quote__by">Post by <Link to={`/profile/${t.author.username}`}>@{t.author.username}</Link></div>}
          <p>{t?.content ?? snap.content ?? '(no text)'}</p>
          {t && <Link to={`/post/${t.id}`} className="link-btn">Open post</Link>}
        </>
      )
      break
    case 'COMMENT':
      body = (
        <>
          {t?.author && <div className="admin-quote__by">Comment by <Link to={`/profile/${t.author.username}`}>@{t.author.username}</Link></div>}
          <p>{t?.content ?? snap.content ?? '(no text)'}</p>
          {t?.postId && <Link to={`/post/${t.postId}`} className="link-btn">Open post</Link>}
        </>
      )
      break
    case 'LISTING':
      body = (
        <>
          {t?.seller && <div className="admin-quote__by">Listing by <Link to={`/profile/${t.seller.username}`}>@{t.seller.username}</Link></div>}
          <p><strong>{t?.title ?? snap.title}</strong>{(t?.price ?? snap.price) != null && ` · ${naira(t?.price ?? snap.price)}`}</p>
          {(t?.description ?? snap.description) && <p>{t?.description ?? snap.description}</p>}
          {t?.status && <StatusPill value={t.status} />}
        </>
      )
      break
    case 'GROUP':
      body = (
        <>
          <p><strong>{t?.name ?? snap.name}</strong>{t?.memberCount != null && ` · ${t.memberCount} members`}</p>
          {(t?.description ?? snap.description) && <p>{t?.description ?? snap.description}</p>}
          {t?.slug && <Link to={`/community/${t.slug}`} className="link-btn">Open group</Link>}
        </>
      )
      break
    default: // USER
      body = (
        <>
          <p><strong>{t?.fullName ?? snap.fullName}</strong> @{t?.username ?? snap.username}{t?.email && ` · ${t.email}`}</p>
          {(t?.bio ?? snap.bio) && <p>{t?.bio ?? snap.bio}</p>}
          {t && <Link to={`/admin/users?open=${t.id}`} className="link-btn">Open in Users</Link>}
          {t && t.isActive === false && <StatusPill value="inactive" />}
        </>
      )
  }

  return (
    <div className="admin-quote">
      {gone && <div className="admin-quote__gone">Already deleted. This is the copy taken when it was reported.</div>}
      {body}
    </div>
  )
}

const DECISIONS = {
  dismiss: { status: 'DISMISSED', action: 'NONE', title: 'Dismiss report', label: 'Dismiss', message: 'Nothing wrong here. Other open reports about the same item are closed too.' },
  reviewed: { status: 'REVIEWED', action: 'NONE', title: 'Close as reviewed', label: 'Close', message: 'Mark it handled without removing anything.' },
  remove: { status: 'REVIEWED', action: 'REMOVE_CONTENT', title: 'Remove content', label: 'Remove', danger: true, message: 'The reported item is removed for everyone.' },
  deactivate: { status: 'REVIEWED', action: 'DEACTIVATE_USER', title: 'Deactivate account', label: 'Deactivate', danger: true, message: 'The owner is signed out everywhere and their content disappears from feeds. Admin accounts cannot be deactivated this way.' },
}

export default function AdminReports() {
  const { showToast } = useApp()
  const { reloadStats } = useOutletContext()
  const [status, setStatus] = useState('PENDING')
  const [targetType, setTargetType] = useState('')
  const [deciding, setDeciding] = useState(null) // { report, kind }

  const list = usePaged(async (cursor) => {
    const { data } = await api.get('/admin/reports', { params: { status, targetType: targetType || undefined, cursor } })
    return { items: data.reports, nextCursor: data.nextCursor }
  }, [status, targetType])

  const decide = async (note) => {
    const { report, kind } = deciding
    const d = DECISIONS[kind]
    const { data } = await api.patch(`/admin/reports/${report.id}/decision`, { status: d.status, action: d.action, note })
    showToast(kind === 'dismiss' ? 'Report dismissed' : 'Report closed')
    // Reports about the same item were settled together, so drop them all from the queue.
    const sameItem = (r) => r.targetType === report.targetType && r.targetId === report.targetId
    if (status === 'PENDING') list.setItems(prev => prev.filter(r => !sameItem(r)))
    else list.setItems(prev => prev.map(r => (r.id === report.id ? { ...r, ...data } : r)))
    reloadStats()
  }

  return (
    <div className="admin-panel">
      <Filters selects={[
        { label: 'Status', value: status, onChange: setStatus, options: [
          { value: 'PENDING', label: 'Waiting for review' },
          { value: 'REVIEWED', label: 'Reviewed' },
          { value: 'DISMISSED', label: 'Dismissed' },
          { value: 'ALL', label: 'All' },
        ] },
        { label: 'Type', value: targetType, onChange: setTargetType, options: [
          { value: '', label: 'Everything' },
          ...TARGETS.map(t => ({ value: t, label: words(t) + 's' })),
        ] },
      ]} />

      <div className="admin-list">
        {list.items.map(r => (
          <article key={r.id} className="admin-item admin-item--stack">
            <div className="admin-item__main">
              <div className="admin-item__title">
                <span className="pill pill--muted">{words(r.targetType)}</span>
                <strong>“{r.reason}”</strong>
                <StatusPill value={r.status} />
                {r.totalReportsOnTarget > 1 && <span className="pill pill--warn">{r.totalReportsOnTarget} reports on this</span>}
              </div>
              <div className="admin-item__meta">
                Reported by {r.reporter ? <Link to={`/profile/${r.reporter.username}`}>@{r.reporter.username}</Link> : 'a deleted account'} · {dateTime(r.createdAt)}
              </div>
              <ReportedContent report={r} />
              {r.status !== 'PENDING' && (
                <div className="admin-item__meta">
                  {words(r.status)}{r.actionTaken && r.actionTaken !== 'NONE' ? ` · ${words(r.actionTaken)}` : ''} · {dateTime(r.reviewedAt)}
                  {r.resolutionNote && ` · “${r.resolutionNote}”`}
                </div>
              )}
            </div>
            {r.status === 'PENDING' && (
              <div className="admin-item__actions">
                <button className="btn btn--ghost btn--sm" onClick={() => setDeciding({ report: r, kind: 'dismiss' })}>Dismiss</button>
                <button className="btn btn--ghost btn--sm" onClick={() => setDeciding({ report: r, kind: 'reviewed' })}>Reviewed, no action</button>
                {r.targetType !== 'USER' && r.targetExists && (
                  <button className="btn btn--danger btn--sm" onClick={() => setDeciding({ report: r, kind: 'remove' })}>Remove content</button>
                )}
                {(r.targetExists) && (
                  <button className="btn btn--danger btn--sm" onClick={() => setDeciding({ report: r, kind: 'deactivate' })}>Deactivate owner</button>
                )}
              </div>
            )}
          </article>
        ))}
        <ListState
          loading={list.loading} error={list.error} empty={!list.items.length}
          emptyText={status === 'PENDING' ? 'No reports waiting. 🎉' : 'No reports here.'}
          hasMore={list.hasMore} onMore={list.loadMore} onRetry={list.reload}
        />
      </div>

      {deciding && (
        <ReasonDialog
          title={DECISIONS[deciding.kind].title}
          message={DECISIONS[deciding.kind].message}
          reasonLabel="Note (saved with the decision)"
          confirmLabel={DECISIONS[deciding.kind].label}
          danger={DECISIONS[deciding.kind].danger}
          onConfirm={decide}
          onClose={() => setDeciding(null)}
        />
      )}
    </div>
  )
}
