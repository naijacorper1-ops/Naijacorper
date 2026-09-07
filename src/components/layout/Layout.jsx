import { NavLink, Outlet } from 'react-router-dom'
import {
  Home, Compass, Users, ShoppingBag, Briefcase,
  Calendar, Building2, MapPinned, Bot,
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
  { to: '/events', label: 'Events', icon: Calendar },
  { to: '/ppa', label: 'PPA reviews', icon: Building2 },
  { to: '/guides', label: 'State guides', icon: MapPinned },
]

// mobile bottom bar keeps only the five primary areas
export default function Layout() {
  const { setComposerOpen, setAssistantOpen } = useApp()

  return (
    <div className="app">
      <Navbar />

      <div className="app__body">
        <aside className="sidenav">
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
            <button className="sidenav__link sidenav__link--sub sidenav__assistant" onClick={() => setAssistantOpen(true)}>
              <Bot size={19} />
              <span>Assistant</span>
            </button>
          </nav>
          <button className="btn btn--primary sidenav__post" onClick={() => setComposerOpen(true)}>
            Post
          </button>
        </aside>

        <main className="app__main">
          <Outlet />
        </main>
      </div>

      <nav className="bottomnav">
        {PRIMARY.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="bottomnav__link">
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <button className="fab" onClick={() => setComposerOpen(true)} aria-label="Create post">+</button>

      <ComposerModal />
      <AssistantModal />
      <Toast />
    </div>
  )
}
