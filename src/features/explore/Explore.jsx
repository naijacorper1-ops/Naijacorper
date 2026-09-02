import {
  BedDouble, UtensilsCrossed, Bus, Hospital, Landmark,
  Printer, ShoppingCart, Pill, Star, MapPin
} from 'lucide-react'

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

const PLACES = [
  { name: "Mama's Kitchen", type: 'Affordable food · Bodija', rating: 4.7,
    note: 'Good portions and cheap. A lot of corps members eat here.' },
  { name: 'Corper Lodge Bodija', type: 'Accommodation · Ibadan', rating: 4.3,
    note: 'Shared self-con units. Close to secretariat and the market.' },
  { name: 'QuickPrint Hub', type: 'Printing · Near camp gate', rating: 4.5,
    note: 'Fast printing, lamination and passport photos. Open early.' },
]

export default function Explore() {
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
          <button key={label} className="cat-tile">
            <span className="cat-tile__icon"><Icon size={22} /></span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <h2 className="section-title">Recommended by corps members</h2>
      <div className="place-list">
        {PLACES.map(p => (
          <article key={p.name} className="place">
            <div className="place__thumb">{p.name.charAt(0)}</div>
            <div className="place__body">
              <div className="place__top">
                <span className="place__name">{p.name}</span>
                <span className="rating"><Star size={14} fill="currentColor" /> {p.rating}</span>
              </div>
              <span className="place__type">{p.type}</span>
              <p className="place__note">“{p.note}”</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}