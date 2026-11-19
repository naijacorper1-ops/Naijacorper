import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import PersonRow from './PersonRow'
import { useApp } from '../../context/AppContext'
import { loadSuggestions } from '../../lib/suggestions'

// "People to follow" card for the right rail (and the top of the feed on
// smaller screens). Hidden when there is nobody to suggest.
export default function SuggestedPeople({ limit = 5, title = 'People to follow', className = '' }) {
  const { me } = useApp()
  const [people, setPeople] = useState(null)
  const myId = me?.id

  useEffect(() => {
    let cancelled = false
    loadSuggestions(me, { limit })
      .then(list => { if (!cancelled) setPeople(list) })
      .catch(() => { if (!cancelled) setPeople([]) })
    return () => { cancelled = true }
    // Only reload when the signed-in user changes, not on every profile update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, limit])

  if (people && people.length === 0) return null

  return (
    <div className={`card suggested ${className}`.trim()}>
      <div className="card__title"><UserPlus size={17} /> {title}</div>
      {people === null && <span className="rail-row__sub">Finding people for you…</span>}
      {people?.map(u => (
        <PersonRow key={u.id} user={u} card={false} note={u.suggestionReason} />
      ))}
      {people?.length > 0 && <Link to="/people" className="suggested__more">See more people</Link>}
    </div>
  )
}
