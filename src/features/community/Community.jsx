import { useState } from 'react'
import { Users, TrendingUp, ArrowRight } from 'lucide-react'

const SCOPES = ['National', 'Lagos', 'Oyo', 'Abuja/FCT', 'Enugu', 'Kano']

const GROUPS = [
  { name: 'Tech Corps Members', members: '12.4k', desc: 'Developers, designers and data folks serving nationwide.' },
  { name: 'NYSC Entrepreneurs', members: '8.1k', desc: 'Building businesses during and after service.' },
  { name: 'Corps Members in Lagos', members: '21.7k', desc: 'Accommodation, transport and meetups in Lagos.' },
  { name: 'Corps Members in Oyo', members: '9.6k', desc: 'Ibadan-based discussions, PPA and living tips.' },
]

const TRENDING = [
  'NYSC relocation', 'PPA experiences', 'CDS attendance',
  'Accommodation in Ibadan', 'Camp packing list',
]

export default function Community() {
  const [scope, setScope] = useState('National')

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Community</h1>
        <p className="page__sub">Conversations and groups across the NYSC journey</p>
      </header>

      <div className="chip-row">
        {SCOPES.map(s => (
          <button
            key={s}
            className={`chip ${scope === s ? 'chip--active' : ''}`}
            onClick={() => setScope(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card__title"><TrendingUp size={17} /> Trending in {scope}</div>
        <div className="tag-cloud">
          {TRENDING.map(t => <span key={t} className="chip chip--soft">{t}</span>)}
        </div>
      </div>

      <h2 className="section-title">Groups</h2>
      <div className="group-grid">
        {GROUPS.map(g => (
          <article key={g.name} className="group">
            <div className="group__head">
              <span className="group__icon"><Users size={18} /></span>
              <div>
                <span className="group__name">{g.name}</span>
                <span className="group__members">{g.members} members</span>
              </div>
            </div>
            <p className="group__desc">{g.desc}</p>
            <button className="btn btn--ghost btn--sm">
              Join group <ArrowRight size={15} />
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}