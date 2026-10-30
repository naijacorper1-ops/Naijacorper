import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  MapPin, CalendarDays, Mail, Settings, LogOut, MoreHorizontal, Flag, VolumeX, Ban, GraduationCap,
} from 'lucide-react'
import PostList from '../../components/post/PostList'
import Modal from '../../components/ui/Modal'
import Avatar, { VerifiedBadge } from '../../components/ui/Avatar'
import FollowButton from '../../components/ui/FollowButton'
import PersonRow from '../../components/ui/PersonRow'
import ListState from '../../components/ui/ListState'
import ReportModal from '../../components/ui/ReportModal'
import { useApp } from '../../context/AppContext'
import { api, errorMessage, uploadFile } from '../../lib/api'
import usePaged from '../../lib/usePaged'
import {
  NIGERIAN_STATES, ROLE_LABELS, ROLE_TO_STAGE_LABEL, cleanUsername, joinedLabel,
  labelOf, PROSPECTIVE_INTERESTS, SERVING_INTERESTS,
} from '../../lib/format'

const TABS = ['Posts', 'Media', 'About']

export default function Profile() {
  const { handle } = useParams()
  const { me } = useApp()
  const username = cleanUsername(handle) || me.username
  return <ProfilePage key={username} username={username} fromLink={!!handle} />
}

function ProfilePage({ username, fromLink }) {
  const navigate = useNavigate()
  const { me, signOut, showToast } = useApp()

  const [user, setUser] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState('Posts')
  const [editing, setEditing] = useState(false)
  const [peopleList, setPeopleList] = useState(null) // 'followers' | 'following'
  const [menuOpen, setMenuOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const menuRef = useRef(null)

  const loadProfile = useCallback(() => api.get(`/users/${username}`)
    .then(({ data }) => { setUser(data); setLoadError('') })
    .catch(err => setLoadError(err?.response?.status === 404
      ? 'This account does not exist or is not available.'
      : errorMessage(err))), [username])

  useEffect(() => { loadProfile() }, [loadProfile])

  useEffect(() => {
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    if (menuOpen) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  const posts = usePaged(async (cursor) => {
    const { data } = await api.get(`/users/${username}/posts`, { params: { cursor } })
    return { items: data.posts, nextCursor: data.nextCursor }
  }, [username])

  const isMe = user?.isMe
  const acceptNew = useCallback((post) => isMe && !post.group, [isMe])

  const message = async () => {
    try {
      const { data } = await api.post(`/messaging/conversations/${user.id}`)
      navigate(`/messages?c=${data.id}`)
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const toggleModeration = async (kind) => {
    setMenuOpen(false)
    const active = kind === 'mute' ? user.isMuted : user.isBlocked
    try {
      if (active) await api.delete(`/users/${user.id}/${kind}`)
      else await api.post(`/users/${user.id}/${kind}`)
      const verb = kind === 'mute' ? (active ? 'Unmuted' : 'Muted') : (active ? 'Unblocked' : 'Blocked')
      showToast(`${verb} @${user.username}`)
      loadProfile()
      if (kind === 'block') posts.reload()
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const logOut = async () => {
    await signOut()
    navigate('/signin', { replace: true })
  }

  if (loadError) return <div className="page"><div className="empty">{loadError}</div></div>
  if (!user) return <div className="page"><div className="empty">Loading…</div></div>

  const mediaUrls = posts.items.flatMap(p => p.mediaUrls || [])
  const interestLabels = (isMe ? me.interests : user.interests || [])
    .map(i => labelOf([...PROSPECTIVE_INTERESTS, ...SERVING_INTERESTS], i))

  return (
    <div className="page">
      <div className="profile-cover" />
      <div className="profile-head">
        <Avatar user={user} className="profile-avatar" />
        <div className="profile-actions">
          {isMe ? (
            <>
              <button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}><Settings size={15} /> Edit profile</button>
              <button className="btn btn--ghost btn--sm" onClick={logOut}><LogOut size={15} /> Sign out</button>
            </>
          ) : (
            <>
              <div className="post__menu" ref={menuRef}>
                <button className="icon-btn icon-btn--sm" onClick={() => setMenuOpen(o => !o)} aria-label="More">
                  <MoreHorizontal size={18} />
                </button>
                {menuOpen && (
                  <div className="menu">
                    <button className="menu__item" onClick={() => { setMenuOpen(false); setReporting(true) }}>
                      <Flag size={15} /> Report @{user.username}
                    </button>
                    <button className="menu__item" onClick={() => toggleModeration('mute')}>
                      <VolumeX size={15} /> {user.isMuted ? 'Unmute' : 'Mute'}
                    </button>
                    <button className="menu__item menu__item--danger" onClick={() => toggleModeration('block')}>
                      <Ban size={15} /> {user.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                  </div>
                )}
              </div>
              {!user.isBlocked && <button className="btn btn--ghost btn--sm" onClick={message}><Mail size={15} /> Message</button>}
              {!user.isBlocked && (
                <FollowButton
                  key={user.id}
                  user={user}
                  onChange={(now) => setUser(u => ({ ...u, isFollowing: now, followersCount: u.followersCount + (now ? 1 : -1) }))}
                />
              )}
            </>
          )}
        </div>
      </div>

      <div className="profile-info">
        <h1 className="profile-name">{user.fullName} <VerifiedBadge user={user} /></h1>
        <span className="profile-handle">@{user.username}{user.followsYou && !isMe ? ' · Follows you' : ''}</span>
        {user.bio && <p className="profile-bio">{user.bio}</p>}
        <div className="profile-meta">
          {ROLE_LABELS[user.role] && <span><GraduationCap size={14} /> {ROLE_TO_STAGE_LABEL[user.role] || ROLE_LABELS[user.role]}</span>}
          {user.state && <span><MapPin size={14} /> {user.state}</span>}
          <span><CalendarDays size={14} /> {joinedLabel(user.createdAt)}</span>
        </div>
        <div className="profile-counts">
          <button className="link-btn" onClick={() => setPeopleList('following')}><strong>{user.followingCount}</strong> Following</button>
          <button className="link-btn" onClick={() => setPeopleList('followers')}><strong>{user.followersCount}</strong> Followers</button>
          <span><strong>{user.postsCount}</strong> Posts</span>
        </div>
        {user.isBlocked && <p className="form-error">You blocked this account. Unblock from the ··· menu to see their posts.</p>}
      </div>

      <div className="tabs tabs--underline">
        {TABS.map(t => (
          <button key={t} className={`tab ${tab === t ? 'tab--active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'About' && (
        <div className="card about-card">
          <div className="about-row"><span>Stage</span><strong>{ROLE_TO_STAGE_LABEL[user.role] || ROLE_LABELS[user.role] || 'Member'}</strong></div>
          {user.state && <div className="about-row"><span>State</span><strong>{user.state}</strong></div>}
          {user.batch && <div className="about-row"><span>Batch</span><strong>{user.batch}{user.stream ? ` · ${user.stream}` : ''}</strong></div>}
          {isMe && me.lga && <div className="about-row"><span>LGA</span><strong>{me.lga} <span className="lock">🔒 private</span></strong></div>}
          {isMe && me.ppa && <div className="about-row"><span>PPA</span><strong>{me.ppa} <span className="lock">🔒 private</span></strong></div>}
          {isMe && <div className="about-row"><span>Email</span><strong>{me.email} <span className="lock">{me.emailVerified ? '✓ verified' : 'not verified'}</span></strong></div>}
          {interestLabels.length > 0 && (
            <div className="about-row"><span>Interests</span><strong>{interestLabels.join(', ')}</strong></div>
          )}
        </div>
      )}

      {tab === 'Media' && (
        mediaUrls.length
          ? <div className="media-grid">{mediaUrls.map(url => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="" loading="lazy" /></a>)}</div>
          : <div className="empty">{posts.loading ? 'Loading…' : 'No media yet.'}</div>
      )}

      {tab === 'Posts' && <PostList paged={posts} acceptNew={acceptNew} emptyText="No posts yet." />}

      {editing && <EditProfile onClose={() => setEditing(false)} onSaved={(updated) => {
        setEditing(false)
        if (fromLink && updated.username !== username) navigate('/profile', { replace: true })
        else loadProfile()
      }} />}

      {peopleList && (
        <PeopleModal username={user.username} kind={peopleList} onClose={() => setPeopleList(null)} />
      )}

      {reporting && (
        <ReportModal title={`Report @${user.username}`} targetType="USER" targetId={user.id} onClose={() => setReporting(false)} />
      )}
    </div>
  )
}

function EditProfile({ onClose, onSaved }) {
  const { me, setMe, showToast } = useApp()
  const [form, setForm] = useState({
    fullName: me.fullName, username: me.username, bio: me.bio || '', state: me.state || '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileInput = useRef(null)

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const body = { fullName: form.fullName.trim(), bio: form.bio.trim() }
      if (form.username !== me.username) body.username = form.username
      if (form.state) body.state = form.state
      const { data } = await api.patch('/users/me', body)
      setMe(data)
      showToast('Profile updated')
      onSaved(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const changePhoto = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    setError('')
    try {
      const { avatarUrl } = await uploadFile('/users/me/avatar', file, {}, 'patch')
      setMe(prev => ({ ...prev, avatarUrl }))
      showToast('Photo updated')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPhotoBusy(false)
    }
  }

  const removePhoto = async () => {
    setPhotoBusy(true)
    try {
      await api.delete('/users/me/avatar')
      setMe(prev => ({ ...prev, avatarUrl: null }))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <div className="edit-photo">
        <Avatar user={me} className="profile-avatar" />
        <div className="btn-row">
          <button className="btn btn--ghost btn--sm" disabled={photoBusy} onClick={() => fileInput.current?.click()}>
            {photoBusy ? 'Uploading…' : 'Change photo'}
          </button>
          {me.avatarUrl && <button className="btn btn--ghost btn--sm" disabled={photoBusy} onClick={removePhoto}>Remove</button>}
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={changePhoto} />
        </div>
      </div>
      <div className="form-grid form-grid--single">
        <label className="field"><span>Name</span>
          <input maxLength={80} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
        </label>
        <label className="field"><span>Username</span>
          <input maxLength={20} value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
        </label>
        <label className="field"><span>Bio</span>
          <textarea rows={3} maxLength={300} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
        </label>
        <label className="field"><span>State</span>
          <select value={form.state} onChange={e => setForm({ ...form, state: e.target.value })}>
            <option value="">Not set</option>
            {NIGERIAN_STATES.map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="btn-row btn-row--end">
        <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" disabled={saving || form.fullName.trim().length < 2 || form.username.length < 3} onClick={save}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Modal>
  )
}

function PeopleModal({ username, kind, onClose }) {
  const people = usePaged(async (cursor) => {
    const { data } = await api.get(`/users/${username}/${kind}`, { params: { cursor } })
    return { items: data.users, nextCursor: data.nextCursor }
  }, [username, kind])

  return (
    <Modal title={kind === 'followers' ? 'Followers' : 'Following'} onClose={onClose}>
      {people.items.map(u => <PersonRow key={u.id} user={u} card={false} />)}
      <ListState
        loading={people.loading}
        error={people.error}
        empty={!people.items.length}
        emptyText={kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
        hasMore={people.hasMore}
        onMore={people.loadMore}
      />
    </Modal>
  )
}
