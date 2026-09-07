import { useState } from 'react'
import { Calendar, MapPin, Users } from 'lucide-react'
import { events } from '../../data/mock'
import { useApp } from '../../context/AppContext'

export default function Events() {
  const { showToast } = useApp()
  const [going, setGoing] = useState(new Set())

  const toggle = (id) => {
    setGoing(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); showToast('RSVP cancelled') }
      else { next.add(id); showToast("You're going 🎉") }
      return next
    })
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Events</h1>
        <p className="page__sub">Meetups, career fairs and corps-member events</p>
      </header>

      <div className="event-list">
        {events.map(e => {
          const isGoing = going.has(e.id)
          return (
            <article key={e.id} className="event">
              <div className="event__date">
                <Calendar size={18} />
                <span>{e.date}</span>
              </div>
              <h3 className="event__title">{e.title}</h3>
              <p className="event__desc">{e.desc}</p>
              <div className="event__meta">
                <span><MapPin size={14} /> {e.loc}</span>
                <span><Users size={14} /> {e.going + (isGoing ? 1 : 0)} going</span>
                <span className="event__org">by {e.org}</span>
              </div>
              <button
                className={`btn btn--sm ${isGoing ? 'btn--ghost' : 'btn--primary'}`}
                onClick={() => toggle(e.id)}
              >
                {isGoing ? 'Going ✓' : 'RSVP'}
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
