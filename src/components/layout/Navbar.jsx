import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search, Bell, MessageCircle, Bot, Menu } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import Avatar from '../ui/Avatar'

export default function Navbar({ onMenu }) {
  const { me, unread, setAssistantOpen } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  // Keep the box in step with the search page (e.g. after clicking a #tag),
  // and clear it when leaving search ("adjust state while rendering").
  const urlQ = location.pathname === '/search'
    ? new URLSearchParams(location.search).get('q') || ''
    : ''
  const [box, setBox] = useState({ urlQ, q: urlQ })
  if (box.urlQ !== urlQ) setBox({ urlQ, q: urlQ })
  const q = box.q
  const setQ = (value) => setBox(b => ({ ...b, q: value }))

  const submit = (e) => {
    e.preventDefault()
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <button className="icon-btn navbar__menu" title="Menu" aria-label="Open menu" onClick={onMenu}>
          <Menu size={21} />
        </button>

        <Link to="/" className="brand">
          <span className="brand__mark"><img src="/logo.png" alt="NaijaCorper logo" /></span>
          <span className="brand__name">NaijaCorper</span>
        </Link>

        <form className="navbar__search" onSubmit={submit} role="search">
          <Search size={18} />
          <input
            placeholder="Search people, #hashtags, places, listings"
            maxLength={60}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search"
          />
        </form>

        <div className="navbar__actions">
          <button className="icon-btn navbar__search-btn" title="Search" aria-label="Search" onClick={() => navigate('/search')}>
            <Search size={20} />
          </button>
          <button className="icon-btn navbar__assistant" title="Assistant" onClick={() => setAssistantOpen(true)}>
            <Bot size={20} />
          </button>
          <button className="icon-btn" title="Messages" onClick={() => navigate('/messages')}>
            <MessageCircle size={20} />
            {unread.messages > 0 && <span className="icon-btn__dot" />}
          </button>
          <button className="icon-btn" title="Notifications" onClick={() => navigate('/notifications')}>
            <Bell size={20} />
            {unread.notifications > 0 && <span className="icon-btn__dot" />}
          </button>
          <Avatar user={me} to="/profile" />
        </div>
      </div>
    </header>
  )
}
