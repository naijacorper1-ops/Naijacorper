import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BedDouble, UtensilsCrossed, Bus, Hospital, Landmark,
  Printer, ShoppingCart, Pill, Star, MapPin,
} from 'lucide-react'
import { places } from '../../data/mock'

const CATEGORIES = [
  { label: 'Accommodation', icon: BedDouble },
  { label: 'Food & restaurants', icon: UtensilsCrossed },
  { label: 'Transport', icon: Bus },
  { label: 'Hospitals', icon: Hospital },
  { label: 'Pharmacies', icon: Pill },
  { label: 'ATMs & banks', icon: Landmark },
  { label: 'Printing / cyber', icon: Printer },
  { label: 'Markets', icon: ShoppingCart },
]

export default function Explore() {
  const [cat, setCat] = useState(null)
  const shown = cat ? places.filter(p => p.cat === cat) : places

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Explore</h1>
        <p className="page__sub">
          <MapPin size={15} /> Around you · Ibadan, Oyo — what's useful nearby
        </p>
      </header>

      <div className="cat-grid">
        {CATEGORIES.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={`cat-tile ${cat === label ? 'cat-tile--on' : ''}`}
            onClick={() => setCat(c => c === label ? null : label)}
          >
            <span className="cat-tile__icon"><Icon size={22} /></span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <h2 className="section-title">{cat ? cat : 'Recommended by corps members'}</h2>
      <div className="place-list">
        {shown.map(p => (
          <Link key={p.id} to={`/explore/${p.id}`} className="place">
            <div className="place__thumb">{p.name.charAt(0)}</div>
            <div className="place__body">
              <div className="place__top">
                <span className="place__name">{p.name}</span>
                <span className="rating"><Star size={14} fill="currentColor" /> {p.rating}</span>
              </div>
              <span className="place__type">{p.type}</span>
              <p className="place__note">“{p.note}”</p>
            </div>
          </Link>
        ))}
        {shown.length === 0 && <div className="empty">No places in this category yet.</div>}
      </div>
    </div>
  )
}
