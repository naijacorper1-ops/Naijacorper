import { Star, MapPin } from 'lucide-react'
import { ppas } from '../../data/mock'

export default function PPA() {
  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">PPA reviews</h1>
        <p className="page__sub">Community-powered reviews of places of primary assignment</p>
      </header>

      <div className="callout">
        Reviews are shared by corps members. Treat them as community experiences, not official ratings.
      </div>

      <div className="ppa-list">
        {ppas.map(p => (
          <article key={p.id} className="ppa">
            <div className="ppa__head">
              <div className="ppa__thumb">{p.name.charAt(0)}</div>
              <div className="ppa__title">
                <span className="ppa__name">{p.name}</span>
                <span className="ppa__loc"><MapPin size={13} /> {p.loc}</span>
              </div>
              <span className="rating ppa__rating"><Star size={15} fill="currentColor" /> {p.rating}</span>
            </div>

            <div className="ppa__stats">
              <div><span>Environment</span><strong>{p.env}</strong></div>
              <div><span>Learning</span><strong>{p.learning}</strong></div>
              <div><span>Workload</span><strong>{p.workload}</strong></div>
            </div>

            <p className="ppa__review">“{p.review}”</p>
            <span className="ppa__reviews">{p.reviews} corps-member reviews</span>
          </article>
        ))}
      </div>
    </div>
  )
}
