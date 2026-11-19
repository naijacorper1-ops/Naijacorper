import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ListState from '../../components/ui/ListState'
import { api } from '../../lib/api'
import usePaged from '../../lib/usePaged'
import { Filters } from './adminShared'
import { dateTime, words } from './adminFormat'

const ACTIONS = [
  'USER_DEACTIVATED', 'USER_REACTIVATED', 'USER_ROLE_CHANGED', 'USER_VERIFICATION_CHANGED',
  'VERIFICATION_APPROVED', 'VERIFICATION_REJECTED', 'VERIFICATION_DOCUMENT_VIEWED', 'REPORT_RESOLVED',
  'POST_REMOVED', 'COMMENT_REMOVED', 'LISTING_REMOVED', 'LISTING_RESTORED', 'GROUP_REMOVED', 'EXPLORE_ENTRY_REMOVED',
]

// Short readable summary of an entry's metadata (username, title, role change…).
function details(meta) {
  if (!meta || typeof meta !== 'object') return ''
  const parts = []
  if (meta.username) parts.push(`@${meta.username}`)
  if (meta.title) parts.push(`“${meta.title}”`)
  if (meta.name) parts.push(`“${meta.name}”`)
  if (meta.from && meta.to) parts.push(`${words(meta.from)} → ${words(meta.to)}`)
  else if (meta.to) parts.push(`→ ${words(meta.to)}`)
  if (meta.status) parts.push(words(meta.status))
  if (meta.action && meta.action !== 'NONE') parts.push(words(meta.action))
  return parts.join(' · ')
}

// Who did what, newest first. ?targetId=… narrows to one user or item.
export default function AdminAudit() {
  const [params, setParams] = useSearchParams()
  const targetId = params.get('targetId') || ''
  const [action, setAction] = useState('')

  const list = usePaged(async (cursor) => {
    const { data } = await api.get('/admin/audit-logs', { params: { action: action || undefined, targetId: targetId || undefined, cursor } })
    return { items: data.logs, nextCursor: data.nextCursor }
  }, [action, targetId])

  return (
    <div className="admin-panel">
      <Filters selects={[{ label: 'Action', value: action, onChange: setAction,
        options: [{ value: '', label: 'All actions' }, ...ACTIONS.map(a => ({ value: a, label: words(a) }))] }]} />
      {targetId && <div className="admin-filter-note">Showing entries for one item. <button className="link-btn" onClick={() => setParams({})}>Show all</button></div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Reason</th></tr></thead>
          <tbody>
            {list.items.map(l => (
              <tr key={l.id}>
                <td className="nowrap">{dateTime(l.createdAt)}</td>
                <td>@{l.adminUsername}</td>
                <td>{words(l.action)}</td>
                <td>
                  {l.targetType === 'USER' && l.targetId
                    ? <Link to={`/admin/users?open=${l.targetId}`}>{details(l.metadata) || 'User'}</Link>
                    : <>{words(l.targetType)} {details(l.metadata)}</>}
                </td>
                <td>{l.reason || <span className="muted-text">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ListState loading={list.loading} error={list.error} empty={!list.items.length} emptyText="Nothing recorded yet."
        hasMore={list.hasMore} onMore={list.loadMore} onRetry={list.reload} />
    </div>
  )
}
