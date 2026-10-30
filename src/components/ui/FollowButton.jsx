import { useState } from 'react'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../context/AppContext'

// Follow / unfollow a user. `user` needs id, username and isFollowing.
export default function FollowButton({ user, onChange, className = '' }) {
  const { showToast, setMe } = useApp()
  const [following, setFollowing] = useState(!!user.isFollowing)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    const next = !following
    setBusy(true)
    setFollowing(next) // show it straight away; undo if the call fails
    try {
      if (next) await api.post(`/users/${user.id}/follow`)
      else await api.delete(`/users/${user.id}/follow`)
      setMe(prev => prev && { ...prev, followingCount: Math.max(0, (prev.followingCount ?? 0) + (next ? 1 : -1)) })
      showToast(next ? `Following @${user.username}` : `Unfollowed @${user.username}`)
      onChange?.(next)
    } catch (err) {
      setFollowing(!next)
      showToast(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      className={`btn btn--sm ${following ? 'btn--ghost' : 'btn--primary'} ${className}`.trim()}
      onClick={toggle}
      disabled={busy}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
