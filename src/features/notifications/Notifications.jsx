import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, UserPlus, Mail, BadgeCheck, ShieldAlert } from 'lucide-react'
import ListState from '../../components/ui/ListState'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { timeAgo } from '../../lib/format'
import usePaged from '../../lib/usePaged'

const KINDS = {
  LIKE: { Icon: Heart, cls: 'notif--like', text: 'liked your post' },
  COMMENT: { Icon: MessageCircle, cls: 'notif--comment', text: 'commented on your post' },
  REPLY: { Icon: MessageCircle, cls: 'notif--comment', text: 'replied to your comment' },
  FOLLOW: { Icon: UserPlus, cls: 'notif--follow', text: 'started following you' },
  MESSAGE: { Icon: Mail, cls: 'notif--message', text: 'sent you a message' },
  VERIFICATION_APPROVED: { Icon: BadgeCheck, cls: 'notif--follow', text: 'Your NYSC verification was approved. You now have the verified badge.' },
  VERIFICATION_REJECTED: { Icon: ShieldAlert, cls: 'notif--like', text: 'Your NYSC verification was not approved.' },
  LISTING_REMOVED: { Icon: ShieldAlert, cls: 'notif--like', text: 'One of your marketplace listings was removed by a moderator.' },
  CONTENT_REMOVED: { Icon: ShieldAlert, cls: 'notif--like', text: 'Some of your content was removed by a moderator.' },
}

function linkFor(n) {
  if (n.postId) return `/post/${n.postId}`
  if (n.conversationId) return `/messages?c=${n.conversationId}`
  if (n.type === 'FOLLOW' && n.actor) return `/profile/${n.actor.username}`
  if (n.listingId) return '/marketplace'
  return null
}

export default function Notifications() {
  const { setUnread } = useApp()
  const list = usePaged(async (cursor) => {
    const { data } = await api.get('/notifications', { params: { cursor } })
    return { items: data.notifications, nextCursor: data.nextCursor }
  }, [])

  // Opening the page counts as reading them.
  useEffect(() => {
    api.patch('/notifications/read-all')
      .then(() => setUnread(u => ({ ...u, notifications: 0 })))
      .catch(() => {})
  }, [setUnread])

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Notifications</h1>
        <p className="page__sub">Likes, replies, follows and messages</p>
      </header>

      <div className="notif-list">
        {list.items.map(n => {
          const kind = KINDS[n.type] || KINDS.LIKE
          const { Icon } = kind
          const to = linkFor(n)
          const body = (
            <>
              <span className={`notif__icon ${kind.cls}`}><Icon size={17} /></span>
              <div className="notif__body">
                <p className="notif__text">
                  {n.actor && <span className="notif__who">{n.actor.fullName}</span>}
                  {n.actor ? ' ' : ''}{kind.text}
                  {n.message && <span className="notif__msg"> “{n.message}”</span>}
                </p>
                <span className="notif__time">{timeAgo(n.createdAt)}</span>
              </div>
              {!n.read && <span className="msg-item__dot" />}
            </>
          )
          return to
            ? <Link key={n.id} to={to} className="notif">{body}</Link>
            : <div key={n.id} className="notif">{body}</div>
        })}
        <ListState
          loading={list.loading}
          error={list.error}
          empty={!list.items.length}
          emptyText="No notifications yet."
          hasMore={list.hasMore}
          onMore={list.loadMore}
          onRetry={list.reload}
        />
      </div>
    </div>
  )
}
