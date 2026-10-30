import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from './api'

const fresh = (key) => ({ key, items: [], nextCursor: null, loading: true, error: '', version: 0 })

// Loads a cursor-paginated list from the API.
//   fetchPage(cursor) must return { items, nextCursor }.
//   deps: when any of these change, the list starts again from page one.
export default function usePaged(fetchPage, deps = []) {
  const key = JSON.stringify(deps)
  const [state, setState] = useState(() => fresh(key))

  // Filters changed: start over (React's "adjust state while rendering" pattern).
  let current = state
  if (state.key !== key) {
    current = fresh(key)
    setState(current)
  }

  const fetchRef = useRef(fetchPage)
  useEffect(() => { fetchRef.current = fetchPage })

  const { version } = current

  // First page, whenever the filters change or reload() is called.
  useEffect(() => {
    let cancelled = false
    fetchRef.current(undefined)
      .then(page => {
        if (cancelled) return
        setState(s => (s.key === key
          ? { ...s, items: page.items, nextCursor: page.nextCursor ?? null, loading: false, error: '' }
          : s))
      })
      .catch(err => {
        if (cancelled) return
        setState(s => (s.key === key ? { ...s, loading: false, error: errorMessage(err) } : s))
      })
    return () => { cancelled = true }
  }, [key, version])

  const loadMore = useCallback(() => {
    const { nextCursor, loading } = current
    if (!nextCursor || loading) return
    setState(s => ({ ...s, loading: true, error: '' }))
    fetchRef.current(nextCursor)
      .then(page => setState(s => (s.key === key
        ? { ...s, items: [...s.items, ...page.items], nextCursor: page.nextCursor ?? null, loading: false }
        : s)))
      .catch(err => setState(s => (s.key === key ? { ...s, loading: false, error: errorMessage(err) } : s)))
  }, [current, key])

  const reload = useCallback(() => {
    setState(s => ({ ...fresh(s.key), version: s.version + 1 }))
  }, [])

  const setItems = useCallback((update) => {
    setState(s => ({ ...s, items: typeof update === 'function' ? update(s.items) : update }))
  }, [])

  return {
    items: current.items,
    setItems,
    loading: current.loading,
    error: current.error,
    hasMore: !!current.nextCursor,
    loadMore,
    reload,
  }
}
