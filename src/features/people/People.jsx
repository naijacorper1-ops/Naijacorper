import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search as SearchIcon } from 'lucide-react'
import PersonRow from '../../components/ui/PersonRow'
import { useApp } from '../../context/AppContext'
import { clearSuggestions, loadSuggestions } from '../../lib/suggestions'

// Full list of suggested people to follow, with a people search on top.
export default function People() {
  const { me } = useApp()
  const navigate = useNavigate()
  const [people, setPeople] = useState(null)
  const [q, setQ] = useState('')
  const myId = me?.id

  useEffect(() => {
    let cancelled = false
    clearSuggestions() // fresh list each time this page opens
    loadSuggestions(me, { limit: 30 })
      .then(list => { if (!cancelled) setPeople(list) })
      .catch(() => { if (!cancelled) setPeople([]) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId])

  const submit = (e) => {
    e.preventDefault()
    const term = q.trim().replace(/^@/, '')
    if (term) navigate(`/search?q=${encodeURIComponent('@' + term)}`)
  }

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">People to follow</h1>
        <p className="page__sub">Corps members you may know, based on who you and your friends follow</p>
      </header>

      <form className="page-search" onSubmit={submit}>
        <SearchIcon size={18} />
        <input placeholder="Find someone by name or @username" maxLength={50} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn--primary btn--sm" disabled={q.trim().replace(/^@/, '').length < 2}>Search</button>
      </form>

      {people === null && <div className="empty">Finding people for you…</div>}
      {people?.length === 0 && (
        <div className="empty">No suggestions yet. Search for people above, or post and join groups to meet corps members.</div>
      )}
      <div className="people-list">
        {people?.map(u => <PersonRow key={u.id} user={u} note={u.suggestionReason} />)}
      </div>
    </div>
  )
}
