import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, TrendingUp, ArrowRight } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { groups } from '../../data/mock'

const SCOPES = ['National', 'Lagos', 'Oyo', 'Abuja/FCT', 'Enugu', 'Kano']
const TRENDING = [
  'NYSC relocation', 'PPA experiences', 'CDS attendance',
  'Accommodation in Ibadan', 'Camp packing list',
]

export default function Community() {
  const { showToast } = useApp()
  const [scope, setScope] = useState('National')
  const [joined, setJoined] = useState(new Set())

  const toggleJoin = (id) => {
    setJoined(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); showToast('Left group') }
      else { next.add(id); showToast('Joined group') }
      return next
    })
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Community</h1>
        <p className="page__sub">Conversations and groups across the NYSC journey</p>
      </header>

      <div className="chip-row">
        {SCOPES.map(s => (
          <button key={s} className={`chip ${scope === s ? 'chip--active' : ''}`} onClick={() => setScope(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card__title"><TrendingUp size={17} /> Trending in {scope}</div>
        <div className="tag-cloud">
          {TRENDING.map(t => (
            <Link key={t} to={`/search?q=${encodeURIComponent(t)}`} className="chip chip--soft">{t}</Link>
          ))}
        </div>
      </div>

      <h2 className="section-title">Groups</h2>
      <div className="group-grid">
        {groups.map(g => {
          const isJoined = joined.has(g.id)
          return (
            <article key={g.id} className="group">
              <div className="group__head">
                <span className="group__icon"><Users size={18} /></span>
                <div>
                  <span className="group__name">{g.name}</span>
                  <span className="group__members">{g.members} members</span>
                </div>
              </div>
              <p className="group__desc">{g.desc}</p>
              <button
                className={`btn btn--sm ${isJoined ? 'btn--ghost' : 'btn--ghost'}`}
                onClick={() => toggleJoin(g.id)}
              >
                {isJoined ? 'Joined ✓' : <>Join group <ArrowRight size={15} /></>}
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
