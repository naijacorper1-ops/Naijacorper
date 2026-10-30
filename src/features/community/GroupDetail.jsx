import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Users, PenSquare, Trash2, Flag } from 'lucide-react'
import PostList from '../../components/post/PostList'
import Modal from '../../components/ui/Modal'
import PersonRow from '../../components/ui/PersonRow'
import ListState from '../../components/ui/ListState'
import ReportModal from '../../components/ui/ReportModal'
import { useApp } from '../../context/AppContext'
import { api, errorMessage } from '../../lib/api'
import usePaged from '../../lib/usePaged'

export default function GroupDetail() {
  const { group: slug } = useParams()
  return <GroupPage key={slug} slug={slug} />
}

function GroupPage({ slug }) {
  const navigate = useNavigate()
  const { openComposer, showToast } = useApp()
  const [group, setGroup] = useState(null)
  const [error, setError] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get(`/groups/${slug}`)
      .then(({ data }) => { if (!cancelled) setGroup(data) })
      .catch(err => { if (!cancelled) setError(errorMessage(err)) })
    return () => { cancelled = true }
  }, [slug])

  const posts = usePaged(async (cursor) => {
    const { data } = await api.get(`/groups/${slug}/posts`, { params: { cursor } })
    return { items: data.posts, nextCursor: data.nextCursor }
  }, [slug])

  const groupId = group?.id
  const acceptNew = useCallback((post) => !!groupId && post.group?.id === groupId, [groupId])

  const toggleJoin = async () => {
    const joining = !group.isMember
    try {
      if (joining) await api.post(`/groups/${group.id}/join`)
      else await api.delete(`/groups/${group.id}/leave`)
      setGroup(g => ({ ...g, isMember: joining, myRole: joining ? 'MEMBER' : null, memberCount: g.memberCount + (joining ? 1 : -1) }))
      showToast(joining ? 'Joined group' : 'Left group')
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  const deleteGroup = async () => {
    if (!window.confirm(`Delete "${group.name}" and all its posts? This cannot be undone.`)) return
    try {
      await api.delete(`/groups/${group.id}`)
      showToast('Group deleted')
      navigate('/community', { replace: true })
    } catch (err) {
      showToast(errorMessage(err))
    }
  }

  if (error || !group) {
    return (
      <div className="page">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate(-1)}><ArrowLeft size={15} /> Back</button>
        <div className="empty">{error || 'Loading…'}</div>
      </div>
    )
  }

  const isOwner = group.myRole === 'OWNER'

  return (
    <div className="page">
      <div className="detail-top">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
        <h1 className="detail-title">{group.name}</h1>
      </div>

      <div className="card group-hero">
        <div className="group__head">
          <span className="group__icon">{group.avatarUrl ? <img src={group.avatarUrl} alt="" /> : <Users size={18} />}</span>
          <div>
            <span className="group__name">{group.name}</span>
            <button className="link-btn group__members" onClick={() => setShowMembers(true)}>
              {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}{group.state ? ` · ${group.state}` : ''}
            </button>
          </div>
        </div>
        {group.description && <p className="group__desc">{group.description}</p>}
        <div className="btn-row">
          {group.isMember && (
            <button className="btn btn--primary btn--sm" onClick={() => openComposer({ groupId: group.id })}>
              <PenSquare size={15} /> Post in group
            </button>
          )}
          {isOwner
            ? <button className="btn btn--ghost btn--sm" onClick={deleteGroup}><Trash2 size={15} /> Delete group</button>
            : <button className="btn btn--ghost btn--sm" onClick={toggleJoin}>{group.isMember ? 'Leave group' : 'Join group'}</button>}
          {!isOwner && <button className="btn btn--ghost btn--sm" onClick={() => setReporting(true)} aria-label="Report group"><Flag size={15} /></button>}
        </div>
      </div>

      <PostList paged={posts} acceptNew={acceptNew} emptyText={group.isMember ? 'No posts yet. Start the conversation!' : 'No posts yet. Join to start the conversation.'} />

      {showMembers && <Members slug={slug} onClose={() => setShowMembers(false)} />}
      {reporting && <ReportModal title="Report group" targetType="GROUP" targetId={group.id} onClose={() => setReporting(false)} />}
    </div>
  )
}

function Members({ slug, onClose }) {
  const members = usePaged(async (cursor) => {
    const { data } = await api.get(`/groups/${slug}/members`, { params: { cursor } })
    // `role` here is the group role (OWNER/MEMBER), not the account type.
    return { items: data.members.map(({ role, ...u }) => ({ ...u, groupRole: role })), nextCursor: data.nextCursor }
  }, [slug])

  return (
    <Modal title="Members" onClose={onClose}>
      {members.items.map(u => <PersonRow key={u.id} user={u} card={false} showFollow={false} />)}
      <ListState
        loading={members.loading}
        error={members.error}
        empty={!members.items.length}
        emptyText="No members yet."
        hasMore={members.hasMore}
        onMore={members.loadMore}
      />
    </Modal>
  )
}
