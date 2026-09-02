import { useState } from 'react'
import { Briefcase, GraduationCap, Calendar, Award, ArrowRight } from 'lucide-react'

const FILTERS = ['All', 'Jobs', 'Internships', 'Scholarships', 'Training', 'Events']

const ITEMS = [
  { type: 'Jobs', icon: Briefcase, title: 'Frontend Developer (Entry)', org: 'PayStack', loc: 'Remote · Nigeria', meta: 'Full-time · ₦300k–450k' },
  { type: 'Internships', icon: Briefcase, title: 'Data Analyst Intern', org: 'Andela', loc: 'Lagos', meta: '6 months · Stipend' },
  { type: 'Scholarships', icon: Award, title: 'Tech4Dev Women Scholarship', org: 'Tech4Dev', loc: 'Online', meta: 'Applications open' },
  { type: 'Training', icon: GraduationCap, title: 'Product Design Bootcamp', org: 'AltSchool', loc: 'Hybrid', meta: 'Weekends · Certificate' },
  { type: 'Events', icon: Calendar, title: 'Tech Corps Meetup', org: 'NaijaCorper', loc: 'Ibadan', meta: 'Sat, 14 Sep · RSVP' },
]

export default function Opportunities() {
  const [filter, setFilter] = useState('All')
  const items = filter === 'All' ? ITEMS : ITEMS.filter(i => i.type === filter)

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Opportunities</h1>
        <p className="page__sub">Jobs, internships, training and events for corps members</p>
      </header>

      <div className="chip-row">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`chip ${filter === f ? 'chip--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="opp-list">
        {items.map((o, i) => {
          const Icon = o.icon
          return (
            <article key={i} className="opp">
              <span className="opp__icon"><Icon size={20} /></span>
              <div className="opp__body">
                <span className="chip chip--soft">{o.type}</span>
                <span className="opp__title">{o.title}</span>
                <span className="opp__org">{o.org} · {o.loc}</span>
                <span className="opp__meta">{o.meta}</span>
              </div>
              <button className="btn btn--primary btn--sm opp__cta">
                View <ArrowRight size={15} />
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}