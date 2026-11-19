import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Avatar, { VerifiedBadge } from '../../components/ui/Avatar'
import ListState from '../../components/ui/ListState'
import Modal from '../../components/ui/Modal'
import { useApp } from '../../context/AppContext'
import { api, errorMessage } from '../../lib/api'
import usePaged from '../../lib/usePaged'
import useDebounced from '../../lib/useDebounced'
import { Filters, ReasonDialog, StatusPill } from './adminShared'
import { ROLES, dateTime, shortDate, words } from './adminFormat'

// Search and manage accounts. ?role=… and ?open=<userId> can be linked to
// from the other admin screens.
export default function AdminUsers() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [role, setRole] = useState(params.get('role') || '')
  const [status, setStatus] = useState('')
  const [verification, setVerification] = useState('')
  const term = useDebounced(q.trim())
  const openId = params.get('open')

  const list = usePaged(async (cursor) => {
    const { data } = await api.get('/admin/users', {
      params: { q: term || undefined, role: role || undefined, status: status || undefined, verification: verification || undefined, cursor },
    })
    return { items: data.users, nextCursor: data.nextCursor }
  }, [term, role, status, verification])

  const open = (id) => setParams(prev => { const p = new URLSearchParams(prev); p.set('open', id); return p })
  const close = () => setParams(prev => { const p = new URLSearchParams(prev); p.delete('open'); return p })
  const updateRow = (user) => list.setItems(prev => prev.map(u => (u.id === user.id ? { ...u, ...user } : u)))

  return (
    <div className="admin-panel">
      <Filters
        q={q} onQ={setQ} placeholder="Search name, username or email"
        selects={[
          { label: 'Role', value: role, onChange: setRole, options: [{ value: '', label: 'All roles' }, ...ROLES.map(r => ({ value: r, label: words(r) }))] },
          { label: 'Status', value: status, onChange: setStatus, options: [{ value: '', label: 'Active and deactivated' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Deactivated' }] },
          { label: 'Badge', value: verification, onChange: setVerification, options: [
            { value: '', label: 'Any badge status' }, { value: 'VERIFIED', label: 'Verified' }, { value: 'PENDING', label: 'Pending' },
            { value: 'REJECTED', label: 'Rejected' }, { value: 'UNVERIFIED', label: 'Unverified' },
          ] },
        ]}
      />

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>User</th><th>Role</th><th>Badge</th><th>Status</th><th className="num">Posts</th><th className="num">Followers</th><th>Joined</th></tr>
          </thead>
          <tbody>
            {list.items.map(u => (
              <tr key={u.id} onClick={() => open(u.id)} className="admin-table__row">
                <td>
                  <div className="admin-user">
                    <Avatar user={u} />
                    <div>
                      <div className="admin-user__name">{u.fullName} <VerifiedBadge user={u} /></div>
                      <div className="muted-text">@{u.username} · {u.email}{!u.emailVerified && ' · email not verified'}</div>
                    </div>
                  </div>
                </td>
                <td>{words(u.role)}</td>
                <td><StatusPill value={u.verificationStatus} /></td>
                <td><StatusPill value={u.isActive ? 'active' : 'inactive'} /></td>
                <td className="num">{u.postsCount}</td>
                <td className="num">{u.followersCount}</td>
                <td>{shortDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ListState
        loading={list.loading} error={list.error} empty={!list.items.length} emptyText="No users match."
        hasMore={list.hasMore} onMore={list.loadMore} onRetry={list.reload}
      />

      {openId && <UserDetail key={openId} id={openId} onClose={close} onChange={updateRow} />}
    </div>
  )
}

function UserDetail({ id, onClose, onChange }) {
  const { me, showToast } = useApp()
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [action, setAction] = useState(null) // 'deactivate' | 'reactivate' | 'role' | 'badge'
  const [newRole, setNewRole] = useState('')

  useEffect(() => {
    api.get(`/admin/users/${id}`)
      .then(({ data }) => { setUser(data); setNewRole(data.role) })
      .catch(err => setError(errorMessage(err)))
  }, [id])

  const isSelf = user?.id === me.id
  const isAdmin = user?.role === 'ADMIN'

  const run = async (reason) => {
    let data
    if (action === 'deactivate') {
      await api.patch(`/admin/users/${id}/deactivate`, { reason })
      data = { ...user, isActive: false }
      showToast(`@${user.username} deactivated`)
    } else if (action === 'reactivate') {
      await api.patch(`/admin/users/${id}/reactivate`, { reason })
      data = { ...user, isActive: true }
      showToast(`@${user.username} reactivated`)
    } else if (action === 'role') {
      data = (await api.patch(`/admin/users/${id}/role`, { role: newRole, reason })).data
      showToast(`@${user.username} is now ${words(newRole)}`)
    } else if (action === 'badge') {
      const next = user.isVerified ? 'UNVERIFIED' : 'VERIFIED'
      data = (await api.patch(`/admin/users/${id}/verification`, { status: next, reason })).data
      showToast(next === 'VERIFIED' ? 'Badge given' : 'Badge removed')
    }
    setUser(prev => ({ ...prev, ...data }))
    onChange({ ...data })
  }

  const dialog = {
    deactivate: { title: 'Deactivate account', message: `@${user?.username} is signed out of every device and their content disappears from feeds.`, label: 'Deactivate', danger: true },
    reactivate: { title: 'Reactivate account', message: `@${user?.username} can sign in again.`, label: 'Reactivate' },
    role: { title: 'Change role', message: `Change @${user?.username} from ${words(user?.role)} to ${words(newRole)}.${newRole === 'ADMIN' ? ' They will get full admin access on their next request.' : ''}`, label: 'Change role', danger: newRole === 'ADMIN' },
    badge: { title: user?.isVerified ? 'Remove verified badge' : 'Give verified badge', message: user?.isVerified ? 'The badge is removed straight away.' : 'Give the badge by hand, without a document.', label: user?.isVerified ? 'Remove badge' : 'Give badge', danger: user?.isVerified },
  }[action]

  return (
    <Modal title="User details" onClose={onClose} wide>
      {error && <div className="empty">{error}</div>}
      {!user && !error && <div className="empty">Loading…</div>}
      {user && (
        <div className="admin-detail">
          <div className="admin-user admin-user--lg">
            <Avatar user={user} />
            <div>
              <div className="admin-user__name">{user.fullName} <VerifiedBadge user={user} /></div>
              <div className="muted-text">@{user.username} · {user.email}</div>
              <div className="admin-detail__pills">
                <StatusPill value={user.isActive ? 'active' : 'inactive'} />
                <span className="pill pill--muted">{words(user.role)}</span>
                <StatusPill value={user.verificationStatus} />
                {!user.emailVerified && <span className="pill pill--warn">Email not verified</span>}
              </div>
            </div>
          </div>

          <dl className="admin-dl">
            <dt>Joined</dt><dd>{dateTime(user.createdAt)}</dd>
            <dt>State / LGA</dt><dd>{[user.state, user.lga].filter(Boolean).join(' / ') || '—'}</dd>
            <dt>Batch / stream</dt><dd>{[user.batch, user.stream].filter(Boolean).join(' / ') || '—'}</dd>
            <dt>PPA</dt><dd>{user.ppa || '—'}</dd>
            <dt>Onboarding</dt><dd>{user.onboardingCompleted ? 'Completed' : 'Not finished'}</dd>
            <dt>Activity</dt><dd>{user.postsCount} posts · {user.listingsCount} listings · {user.followersCount} followers · {user.followingCount} following</dd>
            <dt>Reports</dt><dd>{user.reportsAgainst} against them ({user.pendingReportsAgainst} open) · {user.reportsFiled} filed by them</dd>
            <dt>Latest verification</dt>
            <dd>{user.latestVerification
              ? <>{words(user.latestVerification.documentType)} · <StatusPill value={user.latestVerification.status} /> · {shortDate(user.latestVerification.createdAt)}{user.latestVerification.rejectionReason && ` · “${user.latestVerification.rejectionReason}”`}</>
              : 'None'}</dd>
            {user.bio && <><dt>Bio</dt><dd>{user.bio}</dd></>}
          </dl>

          <div className="admin-detail__links">
            <Link to={`/profile/${user.username}`} className="link-btn">Public profile</Link>
            <Link to={`/admin/content?authorId=${user.id}`} className="link-btn">Their posts</Link>
            <Link to={`/admin/content?tab=listings&sellerId=${user.id}`} className="link-btn">Their listings</Link>
            <Link to={`/admin/audit?targetId=${user.id}`} className="link-btn">Audit history</Link>
          </div>

          {isSelf ? (
            <p className="muted-text">This is your own account. Another admin has to change your role or status.</p>
          ) : (
            <div className="admin-detail__actions">
              <div className="admin-detail__role">
                <select className="admin-input admin-select" value={newRole} onChange={(e) => setNewRole(e.target.value)} aria-label="Role">
                  {ROLES.map(r => <option key={r} value={r}>{words(r)}</option>)}
                </select>
                <button className="btn btn--ghost btn--sm" disabled={newRole === user.role} onClick={() => setAction('role')}>Change role</button>
              </div>
              <button className="btn btn--ghost btn--sm" onClick={() => setAction('badge')}>{user.isVerified ? 'Remove badge' : 'Give badge'}</button>
              {user.isActive
                ? <button className="btn btn--danger btn--sm" disabled={isAdmin} title={isAdmin ? 'Remove the admin role first' : ''} onClick={() => setAction('deactivate')}>Deactivate</button>
                : <button className="btn btn--primary btn--sm" onClick={() => setAction('reactivate')}>Reactivate</button>}
            </div>
          )}
          {!isSelf && isAdmin && user.isActive && <p className="muted-text">Admins can't be deactivated. Change their role first.</p>}
        </div>
      )}

      {dialog && (
        <ReasonDialog
          title={dialog.title} message={dialog.message} confirmLabel={dialog.label} danger={dialog.danger}
          onConfirm={run} onClose={() => setAction(null)}
        />
      )}
    </Modal>
  )
}
