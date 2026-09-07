import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, Briefcase, CalendarDays, Mail, Settings } from 'lucide-react'
import PostCard from '../../components/post/PostCard'
import Modal from '../../components/ui/Modal'
import { useApp } from '../../context/AppContext'
import { users, currentUser } from '../../data/mock'

const TABS = ['Posts', 'Replies', 'Media', 'About']

export default function Profile() {
  const { handle } = useParams()
  const { posts, following, toggleFollow, showToast } = useApp()
  const [tab, setTab] = useState('Posts')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: currentUser.name, bio: currentUser.bio })

  const key = handle || currentUser.handle
  const user = users[key] || currentUser
  const isMe = user.handle === currentUser.handle
  const isFollowing = following.has(user.handle)
  const userPosts = posts.filter(p => p.author === user.handle)

  return (
    <div className="page">
      <div className="profile-cover" />
      <div className="profile-head">
        <div className="profile-avatar avatar">{user.avatar}</div>
        <div className="profile-actions">
          {isMe ? (
            <button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}><Settings size={15} /> Edit profile</button>
          ) : (
            <>
              <button className="btn btn--ghost btn--sm"><Mail size={15} /> Message</button>
              <button
                className={`btn btn--sm ${isFollowing ? 'btn--ghost' : 'btn--primary'}`}
                onClick={() => toggleFollow(user.handle)}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="profile-info">
        <h1 className="profile-name">{user.name}</h1>
        <span className="profile-handle">{user.handle}</span>
        <p className="profile-bio">{user.bio}</p>
        <div className="profile-meta">
          {user.state && <span><MapPin size={14} /> {user.state}</span>}
          {user.profession && <span><Briefcase size={14} /> {user.profession}</span>}
          {user.joined && <span><CalendarDays size={14} /> {user.joined}</span>}
        </div>
        <div className="profile-counts">
          <span><strong>{user.following}</strong> Following</span>
          <span><strong>{user.followers}</strong> Followers</span>
        </div>
        {user.skills?.length > 0 && (
          <div className="profile-skills">
            {user.skills.map(s => <span key={s} className="chip chip--soft">{s}</span>)}
          </div>
        )}
      </div>

      <div className="tabs tabs--underline">
        {TABS.map(t => (
          <button key={t} className={`tab ${tab === t ? 'tab--active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'About' ? (
        <div className="card about-card">
          <div className="about-row"><span>Stage</span><strong>{labelStage(user.stage)}</strong></div>
          {user.state && <div className="about-row"><span>State</span><strong>{user.state}</strong></div>}
          {isMe && user.lga && <div className="about-row"><span>LGA</span><strong>{user.lga}</strong></div>}
          {isMe && user.batch && <div className="about-row"><span>Batch</span><strong>{user.batch}</strong></div>}
          {isMe && user.ppa && <div className="about-row"><span>PPA</span><strong>{user.ppa} <span className="lock">🔒 private</span></strong></div>}
          {user.lookingFor?.length > 0 && (
            <div className="about-row"><span>Looking for</span><strong>{user.lookingFor.join(', ')}</strong></div>
          )}
        </div>
      ) : tab === 'Media' ? (
        <div className="empty">No media yet.</div>
      ) : (
        <div className="feed__list">
          {userPosts.length
            ? userPosts.map(p => <PostCard key={p.id} post={p} />)
            : <div className="empty">No {tab.toLowerCase()} yet.</div>}
        </div>
      )}

      {editing && (
        <Modal title="Edit profile" onClose={() => setEditing(false)}>
          <div className="form-grid form-grid--single">
            <label className="field"><span>Name</span>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field"><span>Bio</span>
              <textarea rows={3} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
            </label>
          </div>
          <div className="btn-row btn-row--end">
            <button className="btn btn--ghost" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn--primary" onClick={() => { setEditing(false); showToast('Profile updated') }}>
              Save changes
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function labelStage(s) {
  return { preparing: 'Preparing for NYSC', serving: 'Currently serving', completed: 'Completed NYSC' }[s] || 'Member'
}
