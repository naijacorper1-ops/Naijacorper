import { Link, useNavigate } from 'react-router-dom'
import { Search, Bell, MessageCircle, Bot } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import Avatar from '../ui/Avatar'

export default function Navbar() {
  const { me, unread, setAssistantOpen } = useApp()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="brand">
          <span className="brand__mark"><img src="/logo.png" alt="NaijaCorper logo" /></span>
          <span className="brand__name">NaijaCorper</span>
        </Link>

        <form className="navbar__search" onSubmit={submit}>
          <Search size={18} />
          <input
            placeholder="Search people, #hashtags, places, listings"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>

        <div className="navbar__actions">
          <button className="icon-btn" title="Assistant" onClick={() => setAssistantOpen(true)}>
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
