import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BedDouble, UtensilsCrossed, Bus, Hospital, Landmark,
  Printer, ShoppingCart, Pill, Star, MapPin, Plus,
} from 'lucide-react'
import Modal from '../../components/ui/Modal'
import ListState from '../../components/ui/ListState'
import { useApp } from '../../context/AppContext'
import { api, errorMessage } from '../../lib/api'
import { EXPLORE_CATEGORIES, NIGERIAN_STATES, labelOf } from '../../lib/format'
import usePaged from '../../lib/usePaged'

const TILES = [
  { value: 'ACCOMMODATION', label: 'Accommodation', icon: BedDouble },
  { value: 'FOOD', label: 'Food', icon: UtensilsCrossed },
  { value: 'TRANSPORT', label: 'Transport', icon: Bus },
  { value: 'HOSPITALS', label: 'Hospitals', icon: Hospital },
  { value: 'PHARMACIES', label: 'Pharmacies', icon: Pill },
  { value: 'ATMS', label: 'ATMs & banks', icon: Landmark },
  { value: 'PRINTING_SERVICES', label: 'Printing', icon: Printer },
  { value: 'MARKETS', label: 'Markets', icon: ShoppingCart },
]
const OTHER = EXPLORE_CATEGORIES.filter(c => !TILES.some(t => t.value === c.value))

export default function Explore() {
  const { me, showToast } = useApp()
  const [cat, setCat] = useState('')
  const [state, setState] = useState(me.state || '')
  const [adding, setAdding] = useState(false)

  const list = usePaged(async (cursor) => {
    const { data } = await api.get('/explore', {
      params: { cursor, category: cat || undefined, state: state || undefined },
    })
    return { items: data.entries, nextCursor: data.nextCursor }
  }, [cat, state])

  return (
    <div className="page">
      <header className="page__head page__head--row">
        <div>
          <h1 className="page__title">Explore</h1>
          <p className="page__sub">
            <MapPin size={15} />{' '}
            <select className="inline-select" value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">All of Nigeria</option>
              {NIGERIAN_STATES.map(s => <option key={s}>{s}</option>)}
            </select>
            {' '}— tips from corps members
          </p>
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => setAdding(true)}>
          <Plus size={16} /> Share a tip
        </button>
      </header>

      <div className="cat-grid">
        {TILES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            className={`cat-tile ${cat === value ? 'cat-tile--on' : ''}`}
            onClick={() => setCat(c => c === value ? '' : value)}
          >
            <span className="cat-tile__icon"><Icon size={22} /></span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="chip-row">
        {OTHER.map(c => (
          <button key={c.value} className={`chip ${cat === c.value ? 'chip--active' : ''}`}
            onClick={() => setCat(prev => prev === c.value ? '' : c.value)}>
            {c.label}
          </button>
        ))}
      </div>

      <h2 className="section-title">{cat ? labelOf(EXPLORE_CATEGORIES, cat) : 'Recommended by corps members'}</h2>
      <div className="place-list">
        {list.items.map(p => <PlaceRow key={p.id} place={p} />)}
      </div>
      <ListState
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        emptyText="No tips here yet. Share the first one!"
        hasMore={list.hasMore}
        onMore={list.loadMore}
        onRetry={list.reload}
      />

      {adding && (
        <AddTip
          defaultState={state || me.state || ''}
          defaultCategory={cat || 'FOOD'}
          onClose={() => setAdding(false)}
          onCreated={(entry) => {
            setAdding(false)
            list.setItems(prev => [entry, ...prev])
            showToast('Thanks for sharing 🎉')
          }}
        />
      )}
    </div>
  )
}

export function PlaceRow({ place }) {
  return (
    <Link to={`/explore/${place.id}`} className="place">
      <div className="place__thumb">{place.name.charAt(0)}</div>
      <div className="place__body">
        <div className="place__top">
          <span className="place__name">{place.name}</span>
          {place.rating && <span className="rating"><Star size={14} fill="currentColor" /> {place.rating}</span>}
        </div>
        <span className="place__type">{labelOf(EXPLORE_CATEGORIES, place.category)} · {place.state}</span>
        <p className="place__note">“{place.description}”</p>
      </div>
    </Link>
  )
}

function AddTip({ defaultState, defaultCategory, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', category: defaultCategory, description: '', state: defaultState, rating: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const { data } = await api.post('/explore', {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim(),
        state: form.state || undefined,
        rating: form.rating ? Number(form.rating) : undefined,
      })
      onCreated(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Share a tip about a place" onClose={onClose}>
      <div className="form-grid">
        <label className="field"><span>Place name</span>
          <input maxLength={120} value={form.name} onChange={set('name')} placeholder="e.g. Mama Put, Bodija" />
        </label>
        <label className="field"><span>Category</span>
          <select value={form.category} onChange={set('category')}>
            {EXPLORE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="field"><span>State</span>
          <select value={form.state} onChange={set('state')}>
            <option value="">My state</option>
            {NIGERIAN_STATES.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="field"><span>Your rating</span>
          <select value={form.rating} onChange={set('rating')}>
            <option value="">No rating</option>
            {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
          </select>
        </label>
      </div>
      <div className="form-grid form-grid--single">
        <label className="field"><span>Your tip</span>
          <textarea rows={3} maxLength={1000} value={form.description} onChange={set('description')}
            placeholder="What should other corpers know? Prices, best time to go, directions…" />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row btn-row--end">
        <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" disabled={saving || form.name.trim().length < 2 || form.description.trim().length < 3} onClick={save}>
          {saving ? 'Sharing…' : 'Share tip'}
        </button>
      </div>
    </Modal>
  )
}
