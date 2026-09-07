import { useSearchParams, Link } from 'react-router-dom'
import PostCard from '../../components/post/PostCard'
import { useApp } from '../../context/AppContext'
import { users, places, opportunities } from '../../data/mock'

export default function Search() {
  const [params] = useSearchParams()
  const q = (params.get('q') || '').toLowerCase().replace('#', '')
  const { posts, following, toggleFollow } = useApp()

  const matchPeople = Object.values(users).filter(u =>
    u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q) ||
    (u.profession || '').toLowerCase().includes(q))
  const matchPosts = posts.filter(p => (p.text || '').toLowerCase().includes(q))
  const matchPlaces = places.filter(p =>
    p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q))
  const matchOpps = opportunities.filter(o =>
    o.title.toLowerCase().includes(q) || o.org.toLowerCase().includes(q))

  const nothing = !matchPeople.length && !matchPosts.length && !matchPlaces.length && !matchOpps.length

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Search</h1>
        <p className="page__sub">Results for “{params.get('q')}”</p>
      </header>

      {nothing && <div className="empty">No results found. Try another search.</div>}

      {matchPeople.length > 0 && (
        <>
          <h2 className="section-title">People</h2>
          {matchPeople.map(u => (
            <div key={u.handle} className="follow-row follow-row--card">
              <Link to={`/profile/${u.handle}`} className="avatar">{u.avatar}</Link>
              <div className="follow-row__info">
                <Link to={`/profile/${u.handle}`} className="follow-row__name">{u.name}</Link>
                <span className="follow-row__sub">{u.handle} · {u.profession}</span>
              </div>
              <button
                className={`btn btn--sm ${following.has(u.handle) ? 'btn--ghost' : 'btn--primary'}`}
                onClick={() => toggleFollow(u.handle)}
              >
                {following.has(u.handle) ? 'Following' : 'Follow'}
              </button>
            </div>
          ))}
        </>
      )}

      {matchPosts.length > 0 && (
        <>
          <h2 className="section-title">Posts</h2>
          <div className="feed__list">
            {matchPosts.map(p => <PostCard key={p.id} post={p} />)}
          </div>
        </>
      )}

      {matchPlaces.length > 0 && (
        <>
          <h2 className="section-title">Places</h2>
          <div className="place-list">
            {matchPlaces.map(p => (
              <Link key={p.id} to={`/explore/${p.id}`} className="place">
                <div className="place__thumb">{p.name.charAt(0)}</div>
                <div className="place__body">
                  <span className="place__name">{p.name}</span>
                  <span className="place__type">{p.type}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {matchOpps.length > 0 && (
        <>
          <h2 className="section-title">Opportunities</h2>
          <div className="opp-list">
            {matchOpps.map(o => (
              <div key={o.id} className="opp">
                <div className="opp__body">
                  <span className="chip chip--soft">{o.type}</span>
                  <span className="opp__title">{o.title}</span>
                  <span className="opp__org">{o.org} · {o.loc}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
