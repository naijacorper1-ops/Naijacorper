import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Home, Compass, Users, ShoppingBag, Briefcase,
  Calendar, Building2, MapPinned, Bot, UserPlus, ShieldCheck, X,
} from 'lucide-react'
import Navbar from './Navbar'
import Toast from '../ui/Toast'
import ComposerModal from '../post/ComposerModal'
import AssistantModal from '../assistant/AssistantModal'
import { useApp } from '../../context/AppContext'

const PRIMARY = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/community', label: 'Community', icon: Users },
  { to: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
  { to: '/opportunities', label: 'Opportunities', icon: Briefcase },
]

const SECONDARY = [
  { to: '/people', label: 'People to follow', icon: UserPlus },
  { to: '/events', label: 'Events', icon: Calendar },
  { to: '/ppa', label: 'PPA reviews', icon: Building2 },
  { to: '/guides', label: 'State guides', icon: MapPinned },
]

const ADMIN_LINK = { to: '/admin', label: 'Admin', icon: ShieldCheck }

function NavLinks({ isAdmin, onAssistant }) {
  return (
    <nav>
      {PRIMARY.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="sidenav__link">
          <Icon size={21} />
          <span>{label}</span>
        </NavLink>
      ))}
      <div className="sidenav__divider" />
      {SECONDARY.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className="sidenav__link sidenav__link--sub">
          <Icon size={19} />
          <span>{label}</span>
        </NavLink>
      ))}
      <button className="sidenav__link sidenav__link--sub sidenav__assistant" onClick={onAssistant}>
        <Bot size={19} />
        <span>Assistant</span>
      </button>
      {isAdmin && (
        <>
          <div className="sidenav__divider" />
          <NavLink to={ADMIN_LINK.to} className="sidenav__link sidenav__link--admin">
            <ADMIN_LINK.icon size={20} />
            <span>{ADMIN_LINK.label}</span>
          </NavLink>
        </>
      )}
    </nav>
  )
}

// mobile bottom bar keeps only the five primary areas; everything else is in
// the menu drawer opened from the navbar.
export default function Layout() {
  const { me, openComposer, setAssistantOpen } = useApp()
  const isAdmin = me.role === 'ADMIN'
  const location = useLocation()
  // The drawer remembers the page it was opened on, so it closes by itself
  // as soon as a link in it takes you somewhere else.
  const [drawerPath, setDrawerPath] = useState(null)
  const drawerOpen = drawerPath === location.pathname
  const setDrawerOpen = (open) => setDrawerPath(open ? location.pathname : null)

  const openAssistant = () => { setDrawerOpen(false); setAssistantOpen(true) }
  const wide = location.pathname.startsWith('/admin')

  return (
    <div className="app">
      <Navbar onMenu={() => setDrawerOpen(true)} />

      <div className={`app__body ${wide ? 'app__body--wide' : ''}`}>
        <aside className="sidenav">
          <NavLinks isAdmin={isAdmin} onAssistant={openAssistant} />
          <button className="btn btn--primary sidenav__post" onClick={() => openComposer()}>
            Post
          </button>
        </aside>

        <main className="app__main">
          {!me.emailVerified && (
            <div className="verify-banner">
              Verify your email to post photos, sell, create groups and get the verified badge.{' '}
              <Link to="/verify-email">Enter your code</Link>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Menu">
            <div className="drawer__head">
              <span className="drawer__title">Menu</span>
              <button className="icon-btn drawer__close" onClick={() => setDrawerOpen(false)} aria-label="Close menu"><X size={20} /></button>
            </div>
            <NavLinks isAdmin={isAdmin} onAssistant={openAssistant} />
          </aside>
        </div>
      )}

      <nav className="bottomnav">
        {PRIMARY.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="bottomnav__link">
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <button className="fab" onClick={() => openComposer()} aria-label="Create post">+</button>

      <ComposerModal />
      <AssistantModal />
      <Toast />
    </div>
  )
}
