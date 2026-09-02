import { Search, Bell, MessageCircle, Bot } from 'lucide-react'

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar__inner">
        <div className="brand">
          <span className="brand__mark">NC</span>
          <span className="brand__name">NaijaCorper</span>
        </div>

        <label className="navbar__search">
          <Search size={18} />
          <input placeholder="Search corps members, places, opportunities" />
        </label>

        <div className="navbar__actions">
          <button className="icon-btn" title="Assistant"><Bot size={20} /></button>
          <button className="icon-btn" title="Messages"><MessageCircle size={20} /></button>
          <button className="icon-btn" title="Notifications">
            <Bell size={20} />
            <span className="icon-btn__dot" />
          </button>
          <div className="avatar" title="Your profile">D</div>
        </div>
      </div>
    </header>
  )
}