import { Link } from 'react-router-dom'

// Shows the user's photo, or the first letter of their name.
export default function Avatar({ user, to, className = '', onClick }) {
  const letter = (user?.fullName || user?.username || '?').trim().charAt(0).toUpperCase()
  const content = user?.avatarUrl
    ? <img src={user.avatarUrl} alt="" className="avatar__img" />
    : letter
  const cls = `avatar ${className}`.trim()

  if (to) return <Link to={to} className={cls} onClick={onClick}>{content}</Link>
  return <div className={cls}>{content}</div>
}

export function VerifiedBadge({ user }) {
  if (!user?.isVerified) return null
  return <span className="verified" title="Verified corps member">✓</span>
}
