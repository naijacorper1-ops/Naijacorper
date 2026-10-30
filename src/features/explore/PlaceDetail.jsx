import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, MapPin, Trash2 } from 'lucide-react'
import Avatar, { VerifiedBadge } from '../../components/ui/Avatar'
import { useApp } from '../../context/AppContext'
import { api, errorMessage } from '../../lib/api'
import { EXPLORE_CATEGORIES, labelOf, timeAgo } from '../../lib/format'
import { PlaceRow } from './Explore'

export default function PlaceDetail() {
  const { id } = useParams()
  return <PlacePage key={id} id={id} />
}

function PlacePage({ id }) {
  const navigate = useNavigate()
  const { me, showToast } = useApp()
  const [place, setPlace] = useState(null)
  const [more, setMore] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get(`/explore/${id}`)
      .then(async ({ data }) => {
        if (cancelled) return
        setPlace(data)
        // Other tips about the same kind of place in the same state.
        const res = await api.get('/explore', { params: { category: data.category, state: data.state, pageSize: 6 } })
        if (!cancelled) setMore(res.data.entries.filter(e => e.id !== data.id))
      })
      .catch(err => { if (!cancelled) setError(errorMessage(err)) })
    return () => { cancelled = true }
  }, [id])

  const remove = async () => {
    try {
      await api.delete(`/explore/${id}`)
      showToast('Tip deleted')
      navigate('/explore', { replace: true })
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  if (error || !place) {
    return (
      <div className="page">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}><ArrowLeft size={15} /> Back</button>
        <div className="empty">{error || 'Loading…'}</div>
      </div>
    )
  }

  const by = place.submittedBy

  return (
    <div className="page">
      <div className="detail-top">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="detail-title">{place.name}</h1>
      </div>

      <div className="place-hero">
        <div className="place-hero__thumb">{place.name.charAt(0)}</div>
        <div>
          <span className="place__type">{labelOf(EXPLORE_CATEGORIES, place.category)}</span>
          <div className="place-hero__row">
            {place.rating && <span className="rating"><Star size={16} fill="currentColor" /> {place.rating}</span>}
            <span className="muted-text"><MapPin size={13} /> {place.state}</span>
          </div>
          <p className="place__note">“{place.description}”</p>
        </div>
      </div>

      <div className="follow-row">
        <Avatar user={by} to={`/profile/${by.username}`} />
        <div className="follow-row__info">
          <Link to={`/profile/${by.username}`} className="follow-row__name">{by.fullName} <VerifiedBadge user={by} /></Link>
          <span className="follow-row__sub">Shared {timeAgo(place.createdAt)}</span>
        </div>
        {by.id === me.id && <button className="btn btn--ghost btn--sm" onClick={remove}><Trash2 size={14} /> Delete</button>}
      </div>

      {more.length > 0 && (
        <>
          <h2 className="section-title">More {labelOf(EXPLORE_CATEGORIES, place.category).toLowerCase()} tips in {place.state}</h2>
          <div className="place-list">{more.map(p => <PlaceRow key={p.id} place={p} />)}</div>
        </>
      )}
    </div>
  )
}
