import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MessageCircle, MapPin, Plus, Search, X, Flag, Trash2 } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Avatar, { VerifiedBadge } from '../../components/ui/Avatar'
import ListState from '../../components/ui/ListState'
import ReportModal from '../../components/ui/ReportModal'
import { useApp } from '../../context/AppContext'
import { api, errorMessage, uploadFile } from '../../lib/api'
import { LISTING_CATEGORIES, NIGERIAN_STATES, labelOf, naira, timeAgo } from '../../lib/format'
import usePaged from '../../lib/usePaged'

const MAX_PHOTOS = 6

export default function Marketplace() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { me, showToast } = useApp()
  const [cat, setCat] = useState('')
  const [state, setState] = useState('')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [mine, setMine] = useState(false)
  const [showSell, setShowSell] = useState(false)
  const openId = params.get('listing')

  const list = usePaged(async (cursor) => {
    const { data } = mine
      ? await api.get('/marketplace/listings/mine', { params: { cursor } })
      : await api.get('/marketplace/listings', {
        params: { cursor, category: cat || undefined, state: state || undefined, q: query || undefined },
      })
    return { items: data.listings, nextCursor: data.nextCursor }
  }, [cat, state, query, mine])

  const replace = (listing) => list.setItems(prev => prev.map(l => l.id === listing.id ? { ...l, ...listing } : l))
  const removeItem = (id) => list.setItems(prev => prev.filter(l => l.id !== id))

  const messageSeller = async (listing) => {
    try {
      const { data } = await api.post(`/messaging/conversations/${listing.seller.id}`)
      navigate(`/messages?c=${data.id}`)
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const setStatus = async (listing, status) => {
    try {
      const { data } = await api.patch(`/marketplace/listings/${listing.id}/status`, { status })
      replace(data)
      showToast(status === 'SOLD' ? 'Marked as sold' : 'Listed again')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const deleteListing = async (listing) => {
    try {
      await api.delete(`/marketplace/listings/${listing.id}`)
      removeItem(listing.id)
      setParams({})
      showToast('Listing deleted')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const actions = { messageSeller, setStatus, deleteListing }

  return (
    <div className="page">
      <header className="page__head page__head--row">
        <div>
          <h1 className="page__title">Marketplace</h1>
          <p className="page__sub">Buy, sell and rent within the corps community</p>
        </div>
        <button className="btn btn--primary btn--sm" onClick={() => setShowSell(true)}>
          <Plus size={16} /> Sell item
        </button>
      </header>

      <div className="market-filters">
        <form className="msg-search" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()) }}>
          <Search size={15} />
          <input placeholder="Search listings" maxLength={60} value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <select value={state} onChange={(e) => setState(e.target.value)} disabled={mine}>
          <option value="">All states</option>
          {NIGERIAN_STATES.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className={`chip ${mine ? 'chip--active' : ''}`} onClick={() => setMine(m => !m)}>My listings</button>
      </div>

      {!mine && (
        <div className="chip-row">
          <button className={`chip ${cat === '' ? 'chip--active' : ''}`} onClick={() => setCat('')}>All</button>
          {LISTING_CATEGORIES.map(c => (
            <button key={c.value} className={`chip ${cat === c.value ? 'chip--active' : ''}`} onClick={() => setCat(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="listing-grid">
        {list.items.map((l) => (
          <article key={l.id} className="listing" onClick={() => setParams({ listing: l.id })}>
            <div className="listing__img">
              {l.imageUrls?.[0] ? <img src={l.imageUrls[0]} alt="" loading="lazy" /> : labelOf(LISTING_CATEGORIES, l.category)}
              {l.status !== 'AVAILABLE' && <span className="listing__status">{l.status === 'SOLD' ? 'Sold' : 'Removed'}</span>}
            </div>
            <div className="listing__body">
              <span className="listing__price">{naira(l.price)}</span>
              <span className="listing__title">{l.title}</span>
              {l.state && <span className="listing__loc"><MapPin size={13} /> {l.state}</span>}
              <span className="listing__seller">{l.isMine ? 'Your listing' : l.seller.fullName}</span>
              <ListingActions listing={l} {...actions} compact />
            </div>
          </article>
        ))}
      </div>
      <ListState
        loading={list.loading}
        error={list.error}
        empty={!list.items.length}
        emptyText={mine ? "You haven't listed anything yet." : 'No listings here yet.'}
        hasMore={list.hasMore}
        onMore={list.loadMore}
        onRetry={list.reload}
      />

      {openId && (
        <ListingDetail
          id={openId}
          cached={list.items.find(l => l.id === openId)}
          onClose={() => setParams({})}
          onChanged={replace}
          {...actions}
        />
      )}

      {showSell && (
        <SellModal
          defaultState={me.state || ''}
          onClose={() => setShowSell(false)}
          onCreated={(listing) => {
            setShowSell(false)
            list.setItems(prev => [listing, ...prev])
            showToast('Listing published 🎉')
          }}
        />
      )}
    </div>
  )
}

function ListingActions({ listing, messageSeller, setStatus, deleteListing, compact }) {
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }
  if (!listing.isMine) {
    return (
      <button className="btn btn--ghost btn--sm listing__cta" onClick={stop(() => messageSeller(listing))}>
        <MessageCircle size={15} /> Message seller
      </button>
    )
  }
  if (listing.status === 'REMOVED') return null
  return (
    <div className="btn-row listing__cta">
      {listing.status === 'AVAILABLE'
        ? <button className="btn btn--ghost btn--sm" onClick={stop(() => setStatus(listing, 'SOLD'))}>Mark sold</button>
        : <button className="btn btn--ghost btn--sm" onClick={stop(() => setStatus(listing, 'AVAILABLE'))}>Relist</button>}
      {!compact && (
        <button className="btn btn--ghost btn--sm" onClick={stop(() => deleteListing(listing))}><Trash2 size={14} /> Delete</button>
      )}
    </div>
  )
}

function ListingDetail({ id, cached, onClose, onChanged, ...actions }) {
  const [listing, setListing] = useState(cached || null)
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState(0)
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    api.get(`/marketplace/listings/${id}`)
      .then(({ data }) => { setListing(data); onChanged(data) })
      .catch(err => setError(errorMessage(err)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const setStatus = async (l, status) => {
    await actions.setStatus(l, status)
    setListing(prev => ({ ...prev, status }))
  }

  return (
    <Modal title={listing?.title || 'Listing'} onClose={onClose} wide>
      {error && <div className="empty">{error}</div>}
      {!listing && !error && <div className="empty">Loading…</div>}
      {listing && (
        <div className="listing-detail">
          {listing.imageUrls?.length > 0 && (
            <div className="listing-detail__photos">
              <img src={listing.imageUrls[photo] || listing.imageUrls[0]} alt="" />
              {listing.imageUrls.length > 1 && (
                <div className="listing-detail__thumbs">
                  {listing.imageUrls.map((url, i) => (
                    <button key={url} className={i === photo ? 'is-on' : ''} onClick={() => setPhoto(i)}><img src={url} alt="" /></button>
                  ))}
                </div>
              )}
            </div>
          )}
          <span className="listing__price">{naira(listing.price)}</span>
          <div className="listing-detail__meta">
            <span className="chip chip--soft">{labelOf(LISTING_CATEGORIES, listing.category)}</span>
            {listing.state && <span><MapPin size={13} /> {listing.state}</span>}
            <span>Listed {timeAgo(listing.createdAt)}</span>
            {listing.status === 'SOLD' && <span className="chip chip--soft">Sold</span>}
          </div>
          <p className="listing-detail__desc">{listing.description}</p>
          {listing.removedReason && <p className="form-error">Removed by a moderator: {listing.removedReason}</p>}

          <div className="follow-row">
            <Avatar user={listing.seller} to={`/profile/${listing.seller.username}`} />
            <div className="follow-row__info">
              <Link to={`/profile/${listing.seller.username}`} className="follow-row__name">
                {listing.seller.fullName} <VerifiedBadge user={listing.seller} />
              </Link>
              <span className="follow-row__sub">@{listing.seller.username} · member since {new Date(listing.seller.createdAt).getFullYear()}</span>
            </div>
          </div>

          <div className="btn-row btn-row--end">
            {!listing.isMine && (
              <button className="btn btn--ghost btn--sm" onClick={() => setReporting(true)}><Flag size={14} /> Report</button>
            )}
            <ListingActions listing={listing} {...actions} setStatus={setStatus} />
          </div>
        </div>
      )}
      {reporting && (
        <ReportModal title="Report listing" targetType="LISTING" targetId={listing.id} onClose={() => setReporting(false)} />
      )}
    </Modal>
  )
}

function SellModal({ defaultState, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', price: '', category: 'FURNITURE', state: defaultState })
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInput = useRef(null)

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const pickPhotos = async (e) => {
    const files = [...e.target.files].slice(0, MAX_PHOTOS - photos.length)
    e.target.value = ''
    setError('')
    for (const file of files) {
      setUploading(n => n + 1)
      try {
        const { url } = await uploadFile('/uploads/listing-image', file)
        setPhotos(prev => [...prev, url])
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setUploading(n => n - 1)
      }
    }
  }

  const price = Number(String(form.price).replace(/[^\d]/g, ''))
  const needsPhoto = form.category !== 'SERVICES' && photos.length === 0
  const ready = form.title.trim().length >= 3 && form.description.trim().length >= 10 &&
    form.price !== '' && !needsPhoto && !uploading && !saving

  const publish = async () => {
    setSaving(true)
    setError('')
    try {
      const { data } = await api.post('/marketplace/listings', {
        title: form.title.trim(),
        description: form.description.trim(),
        price,
        category: form.category,
        state: form.state || undefined,
        imageUrls: photos.length ? photos : undefined,
      })
      onCreated(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="List an item" onClose={onClose}>
      <div className="form-grid">
        <label className="field"><span>Title</span>
          <input maxLength={120} value={form.title} onChange={set('title')} placeholder="e.g. Foam mattress (6x6)" />
        </label>
        <label className="field"><span>Price (₦)</span>
          <input inputMode="numeric" value={form.price} onChange={(e) => setForm(f => ({ ...f, price: e.target.value.replace(/[^\d]/g, '') }))} placeholder="e.g. 28000" />
        </label>
        <label className="field"><span>Category</span>
          <select value={form.category} onChange={set('category')}>
            {LISTING_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="field"><span>State</span>
          <select value={form.state} onChange={set('state')}>
            <option value="">Not set</option>
            {NIGERIAN_STATES.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <div className="form-grid form-grid--single">
        <label className="field"><span>Description</span>
          <textarea rows={3} maxLength={2000} value={form.description} onChange={set('description')}
            placeholder="Condition, size, where to pick up… (at least 10 characters)" />
        </label>
      </div>

      <div className="compose-media">
        {photos.map(url => (
          <div key={url} className="compose-media__item">
            <img src={url} alt="" />
            <button className="compose-media__remove" onClick={() => setPhotos(prev => prev.filter(u => u !== url))} aria-label="Remove"><X size={14} /></button>
          </div>
        ))}
        {uploading > 0 && <div className="compose-media__item compose-media__item--loading">Uploading…</div>}
        {photos.length + uploading < MAX_PHOTOS && (
          <button className="compose-media__item compose-media__add" onClick={() => fileInput.current?.click()}>+ Photo</button>
        )}
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple hidden onChange={pickPhotos} />
      </div>
      {needsPhoto && <p className="onboard__hint">Add at least one photo (not needed for Services).</p>}

      {error && <p className="form-error">{error}</p>}
      <div className="btn-row btn-row--end">
        <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" disabled={!ready} onClick={publish}>
          {saving ? 'Publishing…' : 'Publish listing'}
        </button>
      </div>
    </Modal>
  )
}
