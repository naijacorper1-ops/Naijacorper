import { Link, useOutletContext } from 'react-router-dom'
import { BadgeCheck, Flag } from 'lucide-react'
import { words } from './adminFormat'

function Stat({ label, value, sub }) {
  return (
    <div className="admin-stat">
      <span className="admin-stat__label">{label}</span>
      <span className="admin-stat__value">{(value ?? 0).toLocaleString()}</span>
      {sub && <span className="admin-stat__sub">{sub}</span>}
    </div>
  )
}

// A 14-day bar chart. Days with nothing are missing from the API, so they are filled with 0.
function DayBars({ title, rows = [] }) {
  const byDay = new Map(rows.map(r => [String(r.day).slice(0, 10), r.count]))
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    d.setUTCDate(d.getUTCDate() - (13 - i))
    const key = d.toISOString().slice(0, 10)
    return { key, label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), count: byDay.get(key) ?? 0 }
  })
  const max = Math.max(1, ...days.map(d => d.count))
  const total = days.reduce((s, d) => s + d.count, 0)
  return (
    <div className="admin-panel">
      <div className="admin-panel__title">{title} <span className="muted-text">· {total} in 14 days</span></div>
      <div className="daybars">
        {days.map(d => (
          <div key={d.key} className="daybars__col" title={`${d.label}: ${d.count}`}>
            <span className="daybars__n">{d.count || ''}</span>
            <div className="daybars__bar" style={{ height: `${(d.count / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="daybars__axis"><span>{days[0].label}</span><span>Today</span></div>
    </div>
  )
}

export default function AdminOverview() {
  const { stats, statsError, reloadStats } = useOutletContext()

  if (statsError && !stats) {
    return <div className="admin-panel"><div className="empty">{statsError} <button className="link-btn" onClick={reloadStats}>Try again</button></div></div>
  }
  if (!stats) return <div className="admin-panel"><div className="empty">Loading…</div></div>

  const { needsAttention, users, posts, comments, listings, groups, explore, messages } = stats

  return (
    <>
      <div className="admin-attention">
        <Link to="/admin/verifications" className={`admin-attn ${needsAttention.pendingVerifications ? 'admin-attn--hot' : ''}`}>
          <BadgeCheck size={22} />
          <div>
            <strong>{needsAttention.pendingVerifications}</strong>
            <span>verification {needsAttention.pendingVerifications === 1 ? 'request' : 'requests'} waiting</span>
          </div>
        </Link>
        <Link to="/admin/reports" className={`admin-attn ${needsAttention.pendingReports ? 'admin-attn--hot' : ''}`}>
          <Flag size={22} />
          <div>
            <strong>{needsAttention.pendingReports}</strong>
            <span>{needsAttention.pendingReports === 1 ? 'report' : 'reports'} to review</span>
          </div>
        </Link>
      </div>

      <div className="admin-stats">
        <Stat label="Users" value={users.total} sub={`${users.newLast7Days} new this week · ${users.newLast30Days} this month`} />
        <Stat label="Active" value={users.active} sub={`${users.deactivated} deactivated`} />
        <Stat label="Verified corpers" value={users.verified} sub={`${users.emailNotVerified} emails not verified`} />
        <Stat label="Posts" value={posts.total} sub={`${posts.newLast7Days} this week · ${comments.total.toLocaleString()} comments`} />
        <Stat label="Listings" value={listings.available} sub={`${listings.sold} sold · ${listings.removed} removed · ${listings.newLast7Days} new`} />
        <Stat label="Groups" value={groups.total} sub={`${explore.total} explore tips`} />
        <Stat label="Messages" value={messages.last7Days} sub="last 7 days" />
      </div>

      <div className="admin-two">
        <DayBars title="Sign-ups" rows={stats.signupsByDay} />
        <DayBars title="Posts" rows={stats.postsByDay} />
      </div>

      <div className="admin-panel">
        <div className="admin-panel__title">Users by role</div>
        <div className="admin-roles">
          {Object.entries(users.byRole || {}).sort((a, b) => b[1] - a[1]).map(([role, n]) => (
            <Link key={role} to={`/admin/users?role=${role}`} className="admin-role">
              <span>{words(role)}</span><strong>{n.toLocaleString()}</strong>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
