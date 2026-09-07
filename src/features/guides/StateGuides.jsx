import { useState } from 'react'
import { Bus, UtensilsCrossed, BedDouble, Info } from 'lucide-react'
import { stateGuides } from '../../data/mock'

export default function StateGuides() {
  const [active, setActive] = useState(stateGuides[0].state)
  const guide = stateGuides.find(g => g.state === active)

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">State guides</h1>
        <p className="page__sub">What to know before and during service in each state</p>
      </header>

      <div className="chip-row">
        {stateGuides.map(g => (
          <button
            key={g.state}
            className={`chip ${active === g.state ? 'chip--active' : ''}`}
            onClick={() => setActive(g.state)}
          >
            {g.state}
          </button>
        ))}
      </div>

      <div className="guide-hero">
        <h2>{guide.state}</h2>
        <p>{guide.tagline}</p>
      </div>

      <div className="guide-grid">
        <div className="guide-card">
          <span className="guide-card__icon"><Bus size={18} /></span>
          <h3>Getting around</h3>
          <p>{guide.getAround}</p>
        </div>
        <div className="guide-card">
          <span className="guide-card__icon"><UtensilsCrossed size={18} /></span>
          <h3>Where to eat</h3>
          <p>{guide.eat}</p>
        </div>
        <div className="guide-card">
          <span className="guide-card__icon"><BedDouble size={18} /></span>
          <h3>Where to stay</h3>
          <p>{guide.stay}</p>
        </div>
        <div className="guide-card">
          <span className="guide-card__icon"><Info size={18} /></span>
          <h3>Good to know</h3>
          <p>{guide.know}</p>
        </div>
      </div>
    </div>
  )
}
