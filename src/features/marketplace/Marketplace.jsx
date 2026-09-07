import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, MapPin, Plus } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { useApp } from '../../context/AppContext'
import { listings as seed, marketplaceCategories } from '../../data/mock'

export default function Marketplace() {
  const navigate = useNavigate()
  const { showToast } = useApp()
  const [cat, setCat] = useState('All')
  const [items, setItems] = useState(seed)
  const [showSell, setShowSell] = useState(false)
  const [form, setForm] = useState({ title: '', price: '', cat: 'Furniture', loc: '' })

  const visible = cat === 'All' ? items : items.filter(l => l.cat === cat)

  const publish = () => {
    if (!form.title.trim() || !form.price.trim()) return
    setItems(prev => [
      { id: `l${Date.now()}`, ...form, seller: 'Serving corper', handle: '@david_codes' },
      ...prev,
    ])
    setForm({ title: '', price: '', cat: 'Furniture', loc: '' })
    setShowSell(false)
    showToast('Listing published 🎉')
  }

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

      <div className="chip-row">
        {marketplaceCategories.map(c => (
          <button key={c} className={`chip ${cat === c ? 'chip--active' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="listing-grid">
        {visible.map((l) => (
          <article key={l.id} className="listing">
            <div className="listing__img">{l.cat}</div>
            <div className="listing__body">
              <span className="listing__price">{l.price}</span>
              <span className="listing__title">{l.title}</span>
              <span className="listing__loc"><MapPin size={13} /> {l.loc}</span>
              <span className="listing__seller">{l.seller}</span>
              <button
                className="btn btn--ghost btn--sm listing__cta"
                onClick={() => navigate('/messages')}
              >
                <MessageCircle size={15} /> Message seller
              </button>
            </div>
          </article>
        ))}
      </div>

      {showSell && (
        <Modal title="List an item" onClose={() => setShowSell(false)}>
          <div className="form-grid">
            <label className="field"><span>Title</span>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Foam mattress (6x6)" />
            </label>
            <label className="field"><span>Price</span>
              <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="e.g. ₦28,000" />
            </label>
            <label className="field"><span>Category</span>
              <select value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })}>
                {marketplaceCategories.slice(1).map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="field"><span>Location</span>
              <input value={form.loc} onChange={e => setForm({ ...form, loc: e.target.value })} placeholder="e.g. Bodija, Ibadan" />
            </label>
          </div>
          <div className="btn-row btn-row--end">
            <button className="btn btn--ghost" onClick={() => setShowSell(false)}>Cancel</button>
            <button className="btn btn--primary" disabled={!form.title.trim() || !form.price.trim()} onClick={publish}>
              Publish listing
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
