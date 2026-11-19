import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { Hash, Search as SearchIcon, Users } from 'lucide-react'
import PostList from '../../components/post/PostList'
import PersonRow from '../../components/ui/PersonRow'
import SuggestedPeople from '../../components/ui/SuggestedPeople'
import { api, errorMessage } from '../../lib/api'
import { EXPLORE_CATEGORIES, labelOf, naira } from '../../lib/format'
import usePaged from '../../lib/usePaged'
import { opportunities } from '../../data/mock'

// What the search box understands:
//   #tag   -> posts with that hashtag
//   @name  -> people only
//   text   -> people, hashtags, groups, places, listings and opportunities
function parseQuery(raw) {
  const text = (raw || '').trim().replace(/\s+/g, ' ')
  if (/^#[A-Za-z0-9_]{1,50}/.test(text)) {
    return { kind: 'tag', tag: text.slice(1).match(/^[A-Za-z0-9_]{1,50}/)[0].toLowerCase(), text }
  }
  if (text.startsWith('@')) return { kind: 'people', term: text.replace(/^@+/, '').trim(), text }
  return { kind: 'all', term: text.replace(/^#+/, '').trim(), text }
}

export default function Search() {
  const [params] = useSearchParams()
  const raw = params.get('q') || ''
  const query = parseQuery(raw)

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">{query.kind === 'tag' ? `#${query.tag}` : 'Search'}</h1>
        {query.text && (
          <p className="page__sub">
            {query.kind === 'tag' ? 'Posts with this hashtag' : `Results for “${query.text}”`}
          </p>
        )}
      </header>

      <SearchBox key={`box:${raw}`} initial={raw} />

      {query.kind === 'tag' && <TagResults key={`tag:${query.tag}`} tag={query.tag} />}
      {query.kind !== 'tag' && <AllResults key={`all:${query.text}`} query={query} />}
    </div>
  )
}

// The page has its own box, so search also works on phones (where the navbar
// box is hidden) and the current query can be edited in place.
function SearchBox({ initial }) {
  const navigate = useNavigate()
  const [q, setQ] = useState(initial)
  const submit = (e) => {
    e.preventDefault()
    const text = q.trim()
    if (text) navigate(`/search?q=${encodeURIComponent(text)}`)
  }
  return (
    <form className="page-search" onSubmit={submit} role="search">
      <SearchIcon size={18} />
      <input
        placeholder="Search people, @usernames, #hashtags, groups, places, listings"
        maxLength={60}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search"
      />
      <button className="btn btn--primary btn--sm" disabled={!q.trim()}>Search</button>
    </form>
  )
}

function TagResults({ tag }) {
  const posts = usePaged(async (cursor) => {
    const { data } = await api.get(`/hashtags/${encodeURIComponent(tag)}/posts`, { params: { cursor } })
    return { items: data.posts, nextCursor: data.nextCursor }
  }, [tag])
  return <PostList paged={posts} emptyText={`No posts with #${tag} yet.`} />
}

// Runs one request per section. A section that fails is reported on its own,
// so one slow or broken service doesn't hide the other results.
function AllResults({ query }) {
  const { kind, term } = query
  const [results, setResults] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!term) return undefined
    let cancelled = false
    const run = (enabled, request, pick) => (enabled
      ? request().then(({ data }) => ({ items: pick(data) ?? [] }), (err) => ({ items: [], error: errorMessage(err) }))
      : Promise.resolve({ items: [], skipped: true }))

    const peopleTerm = term.slice(0, 50)
    const everything = kind === 'all'
    Promise.all([
      // The people search needs at least 2 characters.
      run(peopleTerm.length >= 2, () => api.get('/users/search', { params: { q: peopleTerm } }), d => d.users),
      run(everything && /^[A-Za-z0-9_]{1,50}$/.test(term), () => api.get('/hashtags/search', { params: { q: term } }), d => d.hashtags),
      run(everything, () => api.get('/groups', { params: { q: term.slice(0, 60), pageSize: 10 } }), d => d.groups),
      run(everything, () => api.get('/explore', { params: { q: term.slice(0, 60), pageSize: 10 } }), d => d.entries),
      run(everything, () => api.get('/marketplace/listings', { params: { q: term.slice(0, 60), pageSize: 10 } }), d => d.listings),
    ]).then(([people, tags, groups, places, listings]) => {
      if (!cancelled) setResults({ people, tags, groups, places, listings })
    })
    return () => { cancelled = true }
  }, [kind, term, attempt])

  if (!term) {
    return (
      <>
        <div className="empty">Search for people, @usernames, #hashtags, groups, places and listings.</div>
        <SuggestedPeople limit={5} />
      </>
    )
  }
  if (!results) return <div className="empty">Searching…</div>

  const lower = term.toLowerCase()
  const opps = kind === 'all'
    ? opportunities.filter(o => o.title.toLowerCase().includes(lower) || o.org.toLowerCase().includes(lower))
    : []
  const { people, tags, groups, places, listings } = results
  const sections = [people, tags, groups, places, listings]
  const failed = sections.filter(s => s.error)
  const ran = sections.filter(s => !s.skipped)
  const found = sections.some(s => s.items.length) || opps.length > 0
  const retry = <button className="link-btn" onClick={() => { setResults(null); setAttempt(a => a + 1) }}>Try again</button>

  return (
    <>
      {ran.length > 0 && failed.length === ran.length && !opps.length && (
        <div className="empty">{failed[0].error} {retry}</div>
      )}
      {failed.length > 0 && failed.length < ran.length && (
        <div className="search-warning">Some results could not be loaded. {retry}</div>
      )}
      {!found && failed.length < Math.max(ran.length, 1) && (
        <div className="empty">
          {term.length < 2
            ? 'No results. People search needs at least 2 characters.'
            : 'No results found. Try another spelling, an @username or a #hashtag.'}
        </div>
      )}

      {people.items.length > 0 && (
        <>
          <h2 className="section-title">People</h2>
          {people.items.map(u => <PersonRow key={u.id} user={u} />)}
        </>
      )}

      {tags.items.length > 0 && (
        <>
          <h2 className="section-title">Hashtags</h2>
          <div className="tag-cloud">
            {tags.items.map(t => (
              <Link key={t.tag} to={`/search?q=${encodeURIComponent('#' + t.tag)}`} className="chip chip--soft">
                <Hash size={13} /> {t.tag}
              </Link>
            ))}
          </div>
        </>
      )}

      {groups.items.length > 0 && (
        <>
          <h2 className="section-title">Groups</h2>
          <div className="place-list">
            {groups.items.map(g => (
              <Link key={g.id} to={`/community/${g.slug}`} className="place">
                <div className="place__thumb">
                  {g.avatarUrl ? <img src={g.avatarUrl} alt="" /> : <Users size={22} />}
                </div>
                <div className="place__body">
                  <span className="place__name">{g.name}</span>
                  <span className="place__type">
                    {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}{g.state ? ` · ${g.state}` : ''}{g.isMember ? ' · Joined' : ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {places.items.length > 0 && (
        <>
          <h2 className="section-title">Places</h2>
          <div className="place-list">
            {places.items.map(p => (
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

      {listings.items.length > 0 && (
        <>
          <h2 className="section-title">Marketplace</h2>
          <div className="place-list">
            {listings.items.map(l => (
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
