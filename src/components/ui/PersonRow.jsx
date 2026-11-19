import { Link } from 'react-router-dom'
import Avatar, { VerifiedBadge } from './Avatar'
import FollowButton from './FollowButton'
import { useApp } from '../../context/AppContext'
import { userTag } from '../../lib/format'

// One person in a list (search results, suggestions). `note` is an optional
// extra line, e.g. why they are suggested.
export default function PersonRow({ user, card = true, showFollow = true, note }) {
  const { me } = useApp()
  const to = `/profile/${user.username}`
  return (
    <div className={`follow-row ${card ? 'follow-row--card' : ''}`}>
      <Avatar user={user} to={to} />
      <div className="follow-row__info">
        <Link to={to} className="follow-row__name">{user.fullName} <VerifiedBadge user={user} /></Link>
        <span className="follow-row__sub">@{user.username}{userTag(user) ? ` · ${userTag(user)}` : ''}</span>
        {note && <span className="follow-row__note">{note}</span>}
      </div>
      {showFollow && me?.id !== user.id && <FollowButton user={user} />}
    </div>
  )
}
