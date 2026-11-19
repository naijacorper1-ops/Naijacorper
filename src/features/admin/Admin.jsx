import { useCallback, useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { LayoutDashboard, BadgeCheck, Flag, Users, FileText, ScrollText, ShieldCheck } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api, errorMessage } from '../../lib/api'

const TABS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/verifications', label: 'Verifications', icon: BadgeCheck, count: 'pendingVerifications' },
  { to: '/admin/reports', label: 'Reports', icon: Flag, count: 'pendingReports' },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/content', label: 'Content', icon: FileText },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
]

// Admin area. Only accounts with the ADMIN role get in; the backend checks
// the role again on every request.
export default function Admin() {
  const { me } = useApp()
  const isAdmin = me.role === 'ADMIN'
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState('')

  // The overview numbers also feed the "needs attention" badges on the tabs,
  // so every screen can call reloadStats() after a decision.
  const reloadStats = useCallback(() => {
    api.get('/admin/stats')
      .then(({ data }) => { setStats(data); setStatsError('') })
      .catch(err => setStatsError(errorMessage(err)))
  }, [])

  useEffect(() => { if (isAdmin) reloadStats() }, [isAdmin, reloadStats])

  if (!isAdmin) return <Navigate to="/" replace />
  const adminCounts = stats?.needsAttention

  return (
    <div className="page admin">
      <header className="page__head">
        <h1 className="page__title"><ShieldCheck size={24} /> Admin</h1>
        <p className="page__sub">Moderation, verification and user management</p>
      </header>

      <nav className="admin-tabs">
        {TABS.map(({ to, label, icon: Icon, end, count }) => (
          <NavLink key={to} to={to} end={end} className="admin-tab">
            <Icon size={16} />
            <span>{label}</span>
            {count && adminCounts?.[count] > 0 && <span className="admin-tab__count">{adminCounts[count]}</span>}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ stats, statsError, reloadStats }} />
    </div>
  )
}
