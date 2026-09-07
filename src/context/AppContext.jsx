import { createContext, useContext, useState, useCallback } from 'react'
import { posts as seedPosts, currentUser } from '../data/mock'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [posts, setPosts] = useState(seedPosts)
  const [following, setFollowing] = useState(new Set(['@amara_serves']))
  const [likes, setLikes] = useState(new Set())
  const [saved, setSaved] = useState(new Set())
  const [reposted, setReposted] = useState(new Set())
  const [muted, setMuted] = useState(new Set())
  const [blocked, setBlocked] = useState(new Set())
  const [hidden, setHidden] = useState(new Set()) // post ids removed from view
  const [toast, setToast] = useState(null)

  // global modals
  const [composerOpen, setComposerOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }, [])

  const addPost = useCallback((text, quotedId = null) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setPosts(prev => [
      {
        id: Date.now(),
        author: currentUser.handle,
        time: 'now',
        tag: `${currentUser.stage === 'serving' ? 'Serving' : 'Corper'} · ${currentUser.state}`,
        text: trimmed,
        quotedId,
        likes: 0, comments: 0, reposts: 0,
      },
      ...prev,
    ])
    showToast(quotedId ? 'Quote posted 🎉' : 'Post shared 🎉')
  }, [showToast])

  const deletePost = useCallback((id) => {
    setPosts(prev => prev.filter(p => p.id !== id))
    showToast('Post deleted')
  }, [showToast])

  const hidePost = useCallback((id) => {
    setHidden(prev => new Set(prev).add(id))
    showToast('Post reported. Thanks — we\'ll review it.')
  }, [showToast])

  const toggleMute = useCallback((handle) => {
    setMuted(prev => {
      const next = new Set(prev)
      if (next.has(handle)) { next.delete(handle); showToast(`Unmuted ${handle}`) }
      else { next.add(handle); showToast(`Muted ${handle}`) }
      return next
    })
  }, [showToast])

  const toggleBlock = useCallback((handle) => {
    setBlocked(prev => {
      const next = new Set(prev)
      if (next.has(handle)) { next.delete(handle); showToast(`Unblocked ${handle}`) }
      else { next.add(handle); showToast(`Blocked ${handle}`) }
      return next
    })
  }, [showToast])

  const toggleFollow = useCallback((handle) => {
    setFollowing(prev => {
      const next = new Set(prev)
      if (next.has(handle)) { next.delete(handle); showToast(`Unfollowed ${handle}`) }
      else { next.add(handle); showToast(`Following ${handle}`) }
      return next
    })
  }, [showToast])

  const toggleLike = useCallback((id) => {
    setLikes(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const toggleSave = useCallback((id) => {
    setSaved(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); showToast('Removed from saved') }
      else { next.add(id); showToast('Saved') }
      return next
    })
  }, [showToast])

  const toggleRepost = useCallback((id) => {
    setReposted(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) }
      else { next.add(id); showToast('Reposted') }
      return next
    })
  }, [showToast])

  const value = {
    posts, addPost, deletePost, hidePost,
    following, toggleFollow,
    likes, toggleLike,
    saved, toggleSave,
    reposted, toggleRepost,
    muted, toggleMute,
    blocked, toggleBlock,
    hidden,
    toast, showToast,
    composerOpen, setComposerOpen,
    assistantOpen, setAssistantOpen,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
