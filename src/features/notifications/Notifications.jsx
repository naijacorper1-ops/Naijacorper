import { Link } from 'react-router-dom'
import { Heart, MessageCircle, UserPlus, Mail, Briefcase, Calendar } from 'lucide-react'
import { notifications, users } from '../../data/mock'

const ICONS = {
  like: { Icon: Heart, cls: 'notif--like' },
  comment: { Icon: MessageCircle, cls: 'notif--comment' },
  follow: { Icon: UserPlus, cls: 'notif--follow' },
  message: { Icon: Mail, cls: 'notif--message' },
  opportunity: { Icon: Briefcase, cls: 'notif--opp' },
  event: { Icon: Calendar, cls: 'notif--event' },
}

export default function Notifications() {
  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Notifications</h1>
        <p className="page__sub">Likes, replies, follows, messages and opportunities</p>
      </header>

      <div className="notif-list">
        {notifications.map(n => {
          const { Icon, cls } = ICONS[n.type] || ICONS.like
          const u = users[n.who]
          return (
            <div key={n.id} className="notif">
              <span className={`notif__icon ${cls}`}><Icon size={17} /></span>
              <div className="notif__body">
                <p className="notif__text">
                  {u
                    ? <Link to={`/profile/${u.handle}`} className="notif__who">{u.name}</Link>
                    : <span className="notif__who">{n.who}</span>}
                  {' '}{n.text}
                </p>
                <span className="notif__time">{n.time} ago</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
