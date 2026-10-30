// Loading / error / empty / "load more" footer shared by every list screen.
export default function ListState({ loading, error, empty, emptyText, hasMore, onMore, onRetry }) {
  if (error) {
    return (
      <div className="empty">
        {error}{' '}
        {onRetry && <button className="link-btn" onClick={onRetry}>Try again</button>}
      </div>
    )
  }
  if (loading) return <div className="empty">Loading…</div>
  if (empty) return <div className="empty">{emptyText}</div>
  if (hasMore) {
    return (
      <div className="load-more">
        <button className="btn btn--ghost btn--sm" onClick={onMore}>Load more</button>
      </div>
    )
  }
  return null
}
