import { useEffect } from 'react'
import PostCard from './PostCard'
import ListState from '../ui/ListState'
import { useApp } from '../../context/AppContext'

// A paged list of posts (from usePaged). If acceptNew(post) returns true for a
// post just written in the composer, it is added at the top.
export default function PostList({ paged, emptyText = 'No posts yet.', acceptNew }) {
  const { onPostCreated } = useApp()
  const { items, setItems } = paged

  useEffect(() => {
    if (!acceptNew) return undefined
    return onPostCreated(post => {
      if (acceptNew(post)) setItems(prev => [post, ...prev])
    })
  }, [acceptNew, onPostCreated, setItems])

  const remove = (predicate) => setItems(prev => prev.filter(p => !predicate(p)))

  return (
    <div className="feed__list">
      {items.map(p => <PostCard key={p.id} post={p} onRemove={remove} />)}
      <ListState
        loading={paged.loading}
        error={paged.error}
        empty={!items.length}
        emptyText={emptyText}
        hasMore={paged.hasMore}
        onMore={paged.loadMore}
        onRetry={paged.reload}
      />
    </div>
  )
}
