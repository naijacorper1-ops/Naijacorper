import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, MapPin, Lightbulb, MessageCircle } from 'lucide-react'
import { places } from '../../data/mock'
import { useApp } from '../../context/AppContext'

export default function PlaceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useApp()
  const place = places.find(p => p.id === id)

  if (!place) {
    return (
      <div className="page">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}><ArrowLeft size={15} /> Back</button>
        <div className="empty">Place not found.</div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="detail-top">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="detail-title">{place.name}</h1>
      </div>

      <div className="place-hero">
        <div className="place-hero__thumb">{place.name.charAt(0)}</div>
        <div>
          <span className="place__type">{place.type}</span>
          <div className="place-hero__row">
            <span className="rating"><Star size={16} fill="currentColor" /> {place.rating}</span>
            <span className="muted-text">{place.reviews} reviews</span>
          </div>
          <p className="place__note">“{place.note}”</p>
        </div>
      </div>

      <div className="btn-row">
        <button className="btn btn--ghost btn--sm" onClick={() => showToast('Saved place')}>Save</button>
        <button className="btn btn--primary btn--sm" onClick={() => showToast('Review form coming soon')}>
          Write a review
        </button>
      </div>

      <h2 className="section-title"><Lightbulb size={17} /> Corps-member tips</h2>
      <div className="card">
        {place.tips.map((t, i) => (
          <div key={i} className="tip-row">• {t}</div>
        ))}
      </div>

      <h2 className="section-title">Reviews</h2>
      <div className="feed__list">
        <article className="post">
          <div className="post__avatar avatar">A</div>
          <div className="post__body">
            <div className="post__head">
              <span className="post__name">Amara N.</span>
              <span className="post__meta">@amara_serves · 3d</span>
              <span className="rating"><Star size={13} fill="currentColor" /> 5</span>
            </div>
            <p className="post__text">Been coming here since camp. Consistent and affordable.</p>
          </div>
        </article>
        <article className="post">
          <div className="post__avatar avatar">C</div>
          <div className="post__body">
            <div className="post__head">
              <span className="post__name">Chidi Eze</span>
              <span className="post__meta">@chidi_dev · 1w</span>
              <span className="rating"><Star size={13} fill="currentColor" /> 4</span>
            </div>
            <p className="post__text">Good spot, can get busy in the afternoon.</p>
          </div>
        </article>
      </div>
    </div>
  )
}
