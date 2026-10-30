import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Hash } from 'lucide-react'
import PostList from '../../components/post/PostList'
import PersonRow from '../../components/ui/PersonRow'
import { api, errorMessage } from '../../lib/api'
import { EXPLORE_CATEGORIES, labelOf, naira } from '../../lib/format'
import usePaged from '../../lib/usePaged'
import { opportunities } from '../../data/mock'

export default function Search() {
  const [params] = useSearchParams()
  const raw = (params.get('q') || '').trim()
  const isTag = raw.startsWith('#')

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">{isTag ? raw : 'Search'}</h1>
        <p className="page__sub">{isTag ? 'Posts with this hashtag' : `Results for “${raw}”`}</p>
      </header>
      {isTag ? <TagResults key={raw} tag={raw.slice(1)} /> : <AllResults key={raw} q={raw} />}
    </div>
  )
}

function TagResults({ tag }) {
  const posts = usePaged(async (cursor) => {
    const { data } = await api.get(`/hashtags/${encodeURIComponent(tag.toLowerCase())}/posts`, { params: { cursor } })
    return { items: data.posts, nextCursor: data.nextCursor }
  }, [tag])
  return <PostList paged={posts} emptyText={`No posts with #${tag} yet.`} />
}

function AllResults({ q }) {
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!q) return
    const safe = (promise, pick) => promise.then(({ data }) => pick(data)).catch(() => [])
    const short = q.slice(0, 50)
    Promise.all([
      q.length >= 2 ? safe(api.get('/users/search', { params: { q: short } }), d => d.users) : [],
      /^#?[\w]{1,50}$/.test(q) ? safe(api.get('/hashtags/search', { params: { q } }), d => d.hashtags) : [],
      safe(api.get('/explore', { params: { q: q.slice(0, 60), pageSize: 10 } }), d => d.entries),
      safe(api.get('/marketplace/listings', { params: { q: q.slice(0, 60), pageSize: 10 } }), d => d.listings),
    ])
      .then(([people, tags, places, listings]) => setResults({ people, tags, places, listings }))
      .catch(err => setError(errorMessage(err)))
  }, [q])

  if (!q) return <div className="empty">Type something to search.</div>
  if (error) return <div className="empty">{error}</div>
  if (!results) return <div className="empty">Searching…</div>

  const lower = q.toLowerCase()
  const opps = opportunities.filter(o =>
    o.title.toLowerCase().includes(lower) || o.org.toLowerCase().includes(lower))
  const { people, tags, places, listings } = results
  const nothing = !people.length && !tags.length && !places.length && !listings.length && !opps.length

  return (
    <>
      {nothing && <div className="empty">No results found. Try another search, or a #hashtag.</div>}

      {people.length > 0 && (
        <>
          <h2 className="section-title">People</h2>
          {people.map(u => <PersonRow key={u.id} user={u} />)}
        </>
      )}

      {tags.length > 0 && (
        <>
          <h2 className="section-title">Hashtags</h2>
          <div className="tag-cloud">
            {tags.map(t => (
              <Link key={t.tag ?? t.id} to={`/search?q=${encodeURIComponent('#' + t.tag)}`} className="chip chip--soft">
                <Hash size={13} /> {t.tag}
              </Link>
            ))}
          </div>
        </>
      )}

      {places.length > 0 && (
        <>
          <h2 className="section-title">Places</h2>
          <div className="place-list">
            {places.map(p => (
              <Link key={p.id} to={`/explore/${p.id}`} className="place">
                <div className="place__thumb">{p.name.charAt(0)}</div>
                <div className="place__body">
                  <span className="place__name">{p.name}</span>
                  <span className="place__type">{labelOf(EXPLORE_CATEGORIES, p.category)} · {p.state}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {listings.length > 0 && (
        <>
          <h2 className="section-title">Marketplace</h2>
          <div className="place-list">
            {listings.map(l => (
              <Link key={l.id} to={`/marketplace?listing=${l.id}`} className="place">
                <div className="place__thumb">
                  {l.imageUrls?.[0] ? <img src={l.imageUrls[0]} alt="" /> : l.title.charAt(0)}
                </div>
                <div className="place__body">
                  <span className="place__name">{l.title}</span>
                  <span className="place__type">{naira(l.price)}{l.state ? ` · ${l.state}` : ''}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {opps.length > 0 && (
        <>
          <h2 className="section-title">Opportunities</h2>
          <div className="opp-list">
            {opps.map(o => (
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
    </>
  )
}
