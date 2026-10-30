import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, ArrowRight, Plus, Search } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import ListState from '../../components/ui/ListState'
import { useApp } from '../../context/AppContext'
import { api, errorMessage } from '../../lib/api'
import { NIGERIAN_STATES } from '../../lib/format'
import usePaged from '../../lib/usePaged'
import { TrendingTags } from '../home/HomeFeed'

export default function Community() {
  const { me, showToast } = useApp()
  const [scope, setScope] = useState('') // '' = national, 'mine' = my groups, else a state
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const scopes = [
    { id: '', label: 'National' },
    ...(me.state ? [{ id: me.state, label: me.state }] : []),
    { id: 'mine', label: 'My groups' },
  ]

  const groups = usePaged(async (cursor) => {
    const { data } = scope === 'mine'
      ? await api.get('/groups/mine', { params: { cursor } })
      : await api.get('/groups', { params: { cursor, state: scope || undefined, q: query || undefined } })
    return { items: data.groups, nextCursor: data.nextCursor }
  }, [scope, query])

  const toggleJoin = async (group) => {
    const joining = !group.isMember
    try {
      if (joining) await api.post(`/groups/${group.id}/join`)
      else await api.delete(`/groups/${group.id}/leave`)
      groups.setItems(prev => prev.map(g => g.id === group.id
        ? { ...g, isMember: joining, myRole: joining ? 'MEMBER' : null, memberCount: g.memberCount + (joining ? 1 : -1) }
        : g))
      showToast(joining ? `Joined ${group.name}` : `Left ${group.name}`)
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  return (
    <div className="page">
      <header className="page__head page__head--row">
        <div>
          <h1 className="page__title">Community</h1>
          <p className="page__sub">Conversations and groups across the NYSC journey</p>
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => setCreating(true)}>
          <Plus size={16} /> New group
        </button>
      </header>

      <div className="chip-row">
        {scopes.map(s => (
          <button key={s.id || 'national'} className={`chip ${scope === s.id ? 'chip--active' : ''}`} onClick={() => setScope(s.id)}>
            {s.label}
          </button>
        ))}
        <select className="chip" value={NIGERIAN_STATES.includes(scope) && scope !== me.state ? scope : ''}
          onChange={(e) => setScope(e.target.value)}>
          <option value="">Other state…</option>
          {NIGERIAN_STATES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <TrendingTags title="Trending this week" />

      <div className="page__head--row section-row">
        <h2 className="section-title">Groups</h2>
        {scope !== 'mine' && (
          <form className="msg-search" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()) }}>
            <Search size={15} />
            <input placeholder="Search groups" maxLength={60} value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
        )}
      </div>
      <div className="group-grid">
        {groups.items.map(g => (
          <article key={g.id} className="group">
            <Link to={`/community/${g.slug}`} className="group__head">
              <span className="group__icon">
                {g.avatarUrl ? <img src={g.avatarUrl} alt="" /> : <Users size={18} />}
              </span>
              <div>
                <span className="group__name">{g.name}</span>
                <span className="group__members">{g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}{g.state ? ` · ${g.state}` : ''}</span>
              </div>
            </Link>
            {g.description && <p className="group__desc">{g.description}</p>}
            {g.myRole === 'OWNER' ? (
              <Link to={`/community/${g.slug}`} className="btn btn--sm btn--ghost">Your group <ArrowRight size={15} /></Link>
            ) : (
              <button className="btn btn--sm btn--ghost" onClick={() => toggleJoin(g)}>
                {g.isMember ? 'Joined ✓' : <>Join group <ArrowRight size={15} /></>}
              </button>
            )}
          </article>
        ))}
      </div>
      <ListState
        loading={groups.loading}
        error={groups.error}
        empty={!groups.items.length}
        emptyText={scope === 'mine' ? "You haven't joined any groups yet." : 'No groups here yet. Start one!'}
        hasMore={groups.hasMore}
        onMore={groups.loadMore}
        onRetry={groups.reload}
      />

      {creating && (
        <CreateGroup
          defaultState={me.state || ''}
          onClose={() => setCreating(false)}
          onCreated={(group) => {
            setCreating(false)
            groups.setItems(prev => [group, ...prev])
            showToast('Group created 🎉')
          }}
        />
      )}
    </div>
  )
}

function CreateGroup({ defaultState, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', state: defaultState })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const { data } = await api.post('/groups', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        state: form.state || undefined,
      })
      onCreated(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Create a group" onClose={onClose}>
      <div className="form-grid form-grid--single">
        <label className="field"><span>Name</span>
          <input maxLength={60} value={form.name} onChange={set('name')} placeholder="e.g. Lagos Tech Corpers" />
        </label>
        <label className="field"><span>Description</span>
          <textarea rows={3} maxLength={500} value={form.description} onChange={set('description')} placeholder="What is this group about?" />
        </label>
        <label className="field"><span>State (optional)</span>
          <select value={form.state} onChange={set('state')}>
            <option value="">Whole country</option>
            {NIGERIAN_STATES.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row btn-row--end">
        <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" disabled={saving || form.name.trim().length < 3} onClick={save}>
          {saving ? 'Creating…' : 'Create group'}
        </button>
      </div>
    </Modal>
  )
}
