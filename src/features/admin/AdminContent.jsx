import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Trash2, RotateCcw, Users } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import ListState from '../../components/ui/ListState'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { naira } from '../../lib/format'
import usePaged from '../../lib/usePaged'
import useDebounced from '../../lib/useDebounced'
import { Filters, ReasonDialog, StatusPill } from './adminShared'
import { dateTime } from './adminFormat'

const TABS = [
  { id: 'posts', label: 'Posts' },
  { id: 'listings', label: 'Listings' },
  { id: 'groups', label: 'Groups' },
  { id: 'other', label: 'Comments & tips' },
]

// Find and remove posts, listings, groups, comments and explore tips.
// ?tab=…, ?authorId=… and ?sellerId=… can be linked to from the Users screen.
export default function AdminContent() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'posts'
  const setTab = (id) => setParams({ tab: id })

  return (
    <div className="admin-panel">
      <div className="admin-subtabs">
        {TABS.map(t => (
          <button key={t.id} className={`chip ${tab === t.id ? 'chip--active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === 'posts' && <Posts authorId={params.get('authorId')} groupId={params.get('groupId')} clearFilter={() => setTab('posts')} />}
      {tab === 'listings' && <Listings sellerId={params.get('sellerId')} clearFilter={() => setTab('listings')} />}
      {tab === 'groups' && <Groups />}
      {tab === 'other' && <ById />}
    </div>
  )
}

function FilterNote({ text, onClear }) {
  return <div className="admin-filter-note">{text} <button className="link-btn" onClick={onClear}>Show all</button></div>
}

function Posts({ authorId, groupId, clearFilter }) {
  const { showToast } = useApp()
  const [q, setQ] = useState('')
  const term = useDebounced(q.trim())
  const [removing, setRemoving] = useState(null)

  const list = usePaged(async (cursor) => {
    const { data } = await api.get('/admin/posts', { params: { q: term || undefined, authorId: authorId || undefined, groupId: groupId || undefined, cursor } })
    return { items: data.posts, nextCursor: data.nextCursor }
  }, [term, authorId, groupId])

  const remove = async (reason) => {
    await api.delete(`/admin/posts/${removing.id}`, { data: { reason } })
    list.setItems(prev => prev.filter(p => p.id !== removing.id))
    showToast('Post deleted')
  }

  return (
    <>
      <Filters q={q} onQ={setQ} placeholder="Search post text" />
      {(authorId || groupId) && <FilterNote text={authorId ? 'Showing one person’s posts.' : 'Showing one group’s posts.'} onClear={clearFilter} />}
      <div className="admin-list">
        {list.items.map(p => (
          <article key={p.id} className="admin-item">
            <Avatar user={p.author} to={`/profile/${p.author?.username}`} />
            <div className="admin-item__main">
              <div className="admin-item__title">
                <strong>{p.author?.fullName}</strong>
                <span className="muted-text">@{p.author?.username} · {dateTime(p.createdAt)}{p.group ? ` · in ${p.group.name}` : ''}</span>
              </div>
              <p className="admin-item__text">{p.content || (p.repostOfId ? '(repost)' : '(no text)')}</p>
              {p.mediaUrls?.length > 0 && <div className="admin-item__meta">{p.mediaUrls.length} photo/video</div>}
            </div>
            <div className="admin-item__actions">
              <Link to={`/post/${p.id}`} className="btn btn--ghost btn--sm">Open</Link>
              <button className="btn btn--danger btn--sm" onClick={() => setRemoving(p)}><Trash2 size={15} /> Delete</button>
            </div>
          </article>
        ))}
        <ListState loading={list.loading} error={list.error} empty={!list.items.length} emptyText="No posts match."
          hasMore={list.hasMore} onMore={list.loadMore} onRetry={list.reload} />
      </div>
      {removing && (
        <ReasonDialog title="Delete post" danger confirmLabel="Delete"
          message={`Delete this post by @${removing.author?.username}? This can't be undone.`}
          onConfirm={remove} onClose={() => setRemoving(null)} />
      )}
    </>
  )
}

function Listings({ sellerId, clearFilter }) {
  const { showToast } = useApp()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const term = useDebounced(q.trim())
  const [acting, setActing] = useState(null) // { listing, kind: 'remove' | 'restore' }

  const list = usePaged(async (cursor) => {
    const { data } = await api.get('/admin/listings', { params: { q: term || undefined, status: status || undefined, sellerId: sellerId || undefined, cursor } })
    return { items: data.listings, nextCursor: data.nextCursor }
  }, [term, status, sellerId])

  const run = async (reason) => {
    const { listing, kind } = acting
    await api.patch(`/admin/listings/${listing.id}/${kind}`, { reason })
    list.setItems(prev => prev.map(l => (l.id === listing.id
      ? { ...l, status: kind === 'remove' ? 'REMOVED' : 'AVAILABLE', removedReason: kind === 'remove' ? reason : null }
      : l)))
    showToast(kind === 'remove' ? 'Listing removed' : 'Listing restored')
  }

  return (
    <>
      <Filters q={q} onQ={setQ} placeholder="Search listing titles"
        selects={[{ label: 'Status', value: status, onChange: setStatus, options: [
          { value: '', label: 'Any status' }, { value: 'AVAILABLE', label: 'Available' }, { value: 'SOLD', label: 'Sold' }, { value: 'REMOVED', label: 'Removed' },
        ] }]} />
      {sellerId && <FilterNote text="Showing one seller’s listings." onClear={clearFilter} />}
      <div className="admin-list">
        {list.items.map(l => (
          <article key={l.id} className="admin-item">
            <div className="admin-thumb">{l.imageUrls?.[0] ? <img src={l.imageUrls[0]} alt="" /> : l.title.charAt(0)}</div>
            <div className="admin-item__main">
              <div className="admin-item__title"><strong>{l.title}</strong> <StatusPill value={l.status} /></div>
              <div className="admin-item__meta">
                {naira(l.price)}{l.state ? ` · ${l.state}` : ''} · by @{l.seller?.username}{l.seller?.isActive === false ? ' (deactivated)' : ''} · {dateTime(l.createdAt)}
              </div>
              {l.removedReason && <p className="admin-item__note admin-item__note--bad">Removed: {l.removedReason}</p>}
            </div>
            <div className="admin-item__actions">
              {l.status === 'REMOVED'
                ? <button className="btn btn--ghost btn--sm" onClick={() => setActing({ listing: l, kind: 'restore' })}><RotateCcw size={15} /> Restore</button>
                : <button className="btn btn--danger btn--sm" onClick={() => setActing({ listing: l, kind: 'remove' })}><Trash2 size={15} /> Remove</button>}
            </div>
          </article>
        ))}
        <ListState loading={list.loading} error={list.error} empty={!list.items.length} emptyText="No listings match."
          hasMore={list.hasMore} onMore={list.loadMore} onRetry={list.reload} />
      </div>
      {acting && (
        <ReasonDialog
          title={acting.kind === 'remove' ? 'Remove listing' : 'Restore listing'}
          message={acting.kind === 'remove'
            ? `“${acting.listing.title}” is hidden from the marketplace. The seller is notified and sees your reason.`
            : `“${acting.listing.title}” goes back on the marketplace.`}
          reasonLabel={acting.kind === 'remove' ? 'Reason (the seller sees this)' : undefined}
          reasonRequired={acting.kind === 'remove'} minLength={3}
          confirmLabel={acting.kind === 'remove' ? 'Remove' : 'Restore'} danger={acting.kind === 'remove'}
          onConfirm={run} onClose={() => setActing(null)} />
      )}
    </>
  )
}

function Groups() {
  const { showToast } = useApp()
  const [q, setQ] = useState('')
  const term = useDebounced(q.trim())
  const [removing, setRemoving] = useState(null)

  const list = usePaged(async (cursor) => {
    const { data } = await api.get('/admin/groups', { params: { q: term || undefined, cursor } })
    return { items: data.groups, nextCursor: data.nextCursor }
  }, [term])

  const remove = async (reason) => {
    await api.delete(`/admin/groups/${removing.id}`, { data: { reason } })
    list.setItems(prev => prev.filter(g => g.id !== removing.id))
    showToast('Group deleted')
  }

  return (
    <>
      <Filters q={q} onQ={setQ} placeholder="Search group names" />
      <div className="admin-list">
        {list.items.map(g => (
          <article key={g.id} className="admin-item">
            <div className="admin-thumb">{g.avatarUrl ? <img src={g.avatarUrl} alt="" /> : <Users size={20} />}</div>
            <div className="admin-item__main">
              <div className="admin-item__title"><strong>{g.name}</strong></div>
              <div className="admin-item__meta">
                {g.memberCount ?? 0} members{g.state ? ` · ${g.state}` : ''} · created by @{g.createdBy?.username} · {dateTime(g.createdAt)}
              </div>
              {g.description && <p className="admin-item__text">{g.description}</p>}
            </div>
            <div className="admin-item__actions">
              <Link to={`/community/${g.slug}`} className="btn btn--ghost btn--sm">Open</Link>
              <Link to={`/admin/content?tab=posts&groupId=${g.id}`} className="btn btn--ghost btn--sm">Posts</Link>
              <button className="btn btn--danger btn--sm" onClick={() => setRemoving(g)}><Trash2 size={15} /> Delete</button>
            </div>
          </article>
        ))}
        <ListState loading={list.loading} error={list.error} empty={!list.items.length} emptyText="No groups match."
          hasMore={list.hasMore} onMore={list.loadMore} onRetry={list.reload} />
      </div>
      {removing && (
        <ReasonDialog title="Delete group" danger confirmLabel="Delete"
          message={`Delete “${removing.name}” and everything in it? This can't be undone.`}
          onConfirm={remove} onClose={() => setRemoving(null)} />
      )}
    </>
  )
}

// Comments and explore tips have no admin list in the API, so they are
// removed by id (shown on the post page / tip page, or in a report).
function ById() {
  const { showToast } = useApp()
  const [kind, setKind] = useState('comments')
  const [id, setId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const cleanId = id.trim()
  const label = kind === 'comments' ? 'comment' : 'explore tip'

  const remove = async (reason) => {
    await api.delete(`/admin/${kind === 'comments' ? 'comments' : 'explore'}/${encodeURIComponent(cleanId)}`, { data: { reason } })
    showToast(`The ${label} was deleted`)
    setId('')
  }

  return (
    <>
      <p className="muted-text admin-help">
        Comments and explore tips are usually removed from the Reports tab. To remove one directly, paste its id
        (the last part of an explore tip’s address, e.g. /explore/<b>abc123</b>).
      </p>
      <div className="admin-filters">
        <select className="admin-input admin-select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
          <option value="comments">Comment</option>
          <option value="explore">Explore tip</option>
        </select>
        <input className="admin-input" placeholder={`${label[0].toUpperCase() + label.slice(1)} id`} maxLength={64} value={id} onChange={(e) => setId(e.target.value)} />
        <button className="btn btn--danger btn--sm" disabled={!cleanId} onClick={() => setConfirming(true)}><Trash2 size={15} /> Delete</button>
      </div>
      {confirming && (
        <ReasonDialog title={`Delete ${label}`} danger confirmLabel="Delete"
          message={`Delete the ${label} with id ${cleanId}? This can't be undone.`}
          onConfirm={remove} onClose={() => setConfirming(false)} />
      )}
    </>
  )
}
