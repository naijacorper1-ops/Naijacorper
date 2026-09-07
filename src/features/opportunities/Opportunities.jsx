import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, GraduationCap, Award, ArrowRight, Calendar } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { useApp } from '../../context/AppContext'
import { opportunities, opportunityFilters } from '../../data/mock'

const ICONS = { Jobs: Briefcase, Internships: Briefcase, Scholarships: Award, Training: GraduationCap }

export default function Opportunities() {
  const { showToast } = useApp()
  const [filter, setFilter] = useState('All')
  const [active, setActive] = useState(null)

  const items = filter === 'All' ? opportunities : opportunities.filter(i => i.type === filter)

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Opportunities</h1>
        <p className="page__sub">Jobs, internships, training and professional opportunities</p>
      </header>

      <div className="chip-row">
        {opportunityFilters.map(f => (
          <button key={f} className={`chip ${filter === f ? 'chip--active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
        <Link to="/events" className="chip"><Calendar size={13} /> Events</Link>
      </div>

      <div className="opp-list">
        {items.map((o) => {
          const Icon = ICONS[o.type] || Briefcase
          return (
            <article key={o.id} className="opp">
              <span className="opp__icon"><Icon size={20} /></span>
              <div className="opp__body">
                <span className="chip chip--soft">{o.type}</span>
                <span className="opp__title">{o.title}</span>
                <span className="opp__org">{o.org} · {o.loc}</span>
                <span className="opp__meta">{o.meta}</span>
              </div>
              <button className="btn btn--primary btn--sm opp__cta" onClick={() => setActive(o)}>
                View <ArrowRight size={15} />
              </button>
            </article>
          )
        })}
      </div>

      {active && (
        <Modal title={active.title} onClose={() => setActive(null)}>
          <div className="opp-detail">
            <span className="chip chip--soft">{active.type}</span>
            <p className="opp-detail__org">{active.org} · {active.loc}</p>
            <p className="opp-detail__meta">{active.meta}</p>
            <p className="opp-detail__desc">{active.desc}</p>
            <div className="btn-row btn-row--end">
              <button className="btn btn--ghost" onClick={() => showToast('Saved')}>Save</button>
              <button className="btn btn--primary" onClick={() => { showToast('Application started'); setActive(null) }}>
                Apply now
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
