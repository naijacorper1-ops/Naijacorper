import { useState } from 'react'
import { MessageCircle, MapPin } from 'lucide-react'

const CATEGORIES = ['All', 'Phones', 'Laptops', 'Furniture', 'Fashion', 'Kitchen', 'Books', 'Accommodation']

const LISTINGS = [
  { title: 'Foam mattress (6x6) — clean', price: '₦28,000', cat: 'Furniture', loc: 'Bodija, Ibadan', seller: 'Outgoing corper' },
  { title: 'HP EliteBook, 8GB RAM', price: '₦145,000', cat: 'Laptops', loc: 'Yaba, Lagos', seller: 'Serving corper' },
  { title: 'Gas cooker + small cylinder', price: '₦19,500', cat: 'Kitchen', loc: 'Enugu', seller: 'Serving corper' },
  { title: 'Self-con near secretariat', price: '₦180,000/yr', cat: 'Accommodation', loc: 'Agodi, Ibadan', seller: 'Verified agent' },
  { title: 'Android phone (Infinix)', price: '₦72,000', cat: 'Phones', loc: 'Kaduna', seller: 'Serving corper' },
  { title: 'Reading table & chair', price: '₦15,000', cat: 'Furniture', loc: 'Lagos', seller: 'Outgoing corper' },
]

export default function Marketplace() {
  const [cat, setCat] = useState('All')
  const items = cat === 'All' ? LISTINGS : LISTINGS.filter(l => l.cat === cat)

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Marketplace</h1>
        <p className="page__sub">Buy, sell and rent within the corps community</p>
      </header>

      <div className="chip-row">
        {CATEGORIES.map(c => (
          <button
            key={c}
            className={`chip ${cat === c ? 'chip--active' : ''}`}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="listing-grid">
        {items.map((l, i) => (
          <article key={i} className="listing">
            <div className="listing__img">{l.cat}</div>
            <div className="listing__body">
              <span className="listing__price">{l.price}</span>
              <span className="listing__title">{l.title}</span>
              <span className="listing__loc"><MapPin size={13} /> {l.loc}</span>
              <span className="listing__seller">{l.seller}</span>
              <button className="btn btn--ghost btn--sm listing__cta">
                <MessageCircle size={15} /> Message seller
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}