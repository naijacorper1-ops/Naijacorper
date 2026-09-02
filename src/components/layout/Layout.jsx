import { NavLink, Outlet } from 'react-router-dom'
import { Home, Compass, Users, ShoppingBag, Briefcase } from 'lucide-react'
import Navbar from './Navbar'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/community', label: 'Community', icon: Users },
  { to: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
  { to: '/opportunities', label: 'Opportunities', icon: Briefcase },
]

export default function Layout() {
  return (
    <div className="app">
      <Navbar />

      <div className="app__body">
        <aside className="sidenav">
          <nav>
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="sidenav__link">
                <Icon size={21} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <button className="btn btn--primary sidenav__post">Post</button>
        </aside>

        <main className="app__main">
          <Outlet />
        </main>
      </div>

      <nav className="bottomnav">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="bottomnav__link">
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}