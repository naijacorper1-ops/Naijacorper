import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { api, setAccessToken, setOnSessionExpired } from '../lib/api'

const AppContext = createContext(null)

// initialUser comes from main.jsx, which restores the session before the first render.
export function AppProvider({ initialUser, children }) {
  // The signed-in user (GET /users/me), or null when signed out.
  const [me, setMe] = useState(initialUser)

  const [toast, setToast] = useState(null)
  const [unread, setUnread] = useState({ notifications: 0, messages: 0 })

  // global modals
  const [composer, setComposer] = useState(null) // null = closed, else { quote, groupId }
  const [assistantOpen, setAssistantOpen] = useState(false)

  const toastTimer = useRef(null)
  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  const refreshMe = useCallback(async () => {
    const { data } = await api.get('/users/me')
    setMe(data)
    return data
  }, [])

  useEffect(() => {
    setOnSessionExpired(() => { setAccessToken(null); setMe(null) })
  }, [])

  // After login/register: keep the token and load the user.
  const signIn = useCallback(async (token) => {
    setAccessToken(token)
    return refreshMe()
  }, [refreshMe])

  const signOut = useCallback(async () => {
    try { await api.post('/auth/logout') } catch { /* signed out locally either way */ }
    setAccessToken(null)
    setMe(null)
  }, [])

  // Unread badges for the navbar, refreshed every 30 seconds while signed in.
  const refreshUnread = useCallback(async () => {
    try {
      const [n, m] = await Promise.all([
        api.get('/notifications/unread-count'),
        api.get('/messaging/unread-count'),
      ])
      setUnread({ notifications: n.data.count, messages: m.data.count })
    } catch { /* badges are not important enough to show an error */ }
  }, [])

  const signedIn = !!me
  useEffect(() => {
    if (!signedIn) return undefined
    const first = setTimeout(refreshUnread, 0)
    const timer = setInterval(refreshUnread, 30000)
    return () => { clearTimeout(first); clearInterval(timer) }
  }, [signedIn, refreshUnread])

  // Lists that show posts (home feed, profile, group) listen here so a post
  // written in the composer appears at the top straight away.
  const postListeners = useRef(new Set())
  const onPostCreated = useCallback((fn) => {
    postListeners.current.add(fn)
    return () => postListeners.current.delete(fn)
  }, [])

  const createPost = useCallback(async (body) => {
    const { data } = await api.post('/posts', body)
    postListeners.current.forEach(fn => fn(data))
    setMe(prev => (prev && !body.groupId ? { ...prev, postsCount: (prev.postsCount ?? 0) + 1 } : prev))
    return data
  }, [])

  const openComposer = useCallback((options = {}) => setComposer(options), [])
  const closeComposer = useCallback(() => setComposer(null), [])

  const value = {
    me, setMe, refreshMe, signIn, signOut,
    toast, showToast,
    unread, setUnread, refreshUnread,
    onPostCreated, createPost,
    composer, openComposer, closeComposer,
    assistantOpen, setAssistantOpen,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
