import { api } from './api'

// "People to follow", built from what the API already offers (there is no
// suggestions endpoint yet). Candidates, best first:
//   1. people who follow you but you don't follow back
//   2. people followed by the people you follow ("followed by @ada")
//   3. recent posters in the national feed, people in your state first
// Anyone you already follow, and yourself, is left out. The result is cached
// for a few minutes so moving between pages doesn't refetch it.

const CACHE_MS = 5 * 60 * 1000
const FRIENDS_TO_SCAN = 5
let cache = null // { userId, at, list }

export function clearSuggestions() {
  cache = null
}

const settle = (promise) => promise.then(({ data }) => data).catch(() => null)

export async function loadSuggestions(me, { limit = 5 } = {}) {
  if (!me) return []
  if (cache && cache.userId === me.id && Date.now() - cache.at < CACHE_MS) {
    return cache.list.slice(0, limit)
  }

  const [followingData, followersData, feedData] = await Promise.all([
    settle(api.get(`/users/${encodeURIComponent(me.username)}/following`, { params: { pageSize: 50 } })),
    settle(api.get(`/users/${encodeURIComponent(me.username)}/followers`, { params: { pageSize: 50 } })),
    settle(api.get('/feed', { params: { scope: 'NATIONAL', pageSize: 40 } })),
  ])

  const following = followingData?.users ?? []
  const followingIds = new Set(following.map(u => u.id))
  const skip = (u) => !u || u.id === me.id || followingIds.has(u.id) || u.isFollowing

  const found = new Map() // id -> { user, score, reason }
  const add = (user, score, reason) => {
    if (skip(user)) return
    const prev = found.get(user.id)
    if (prev) {
      prev.score += score
      if (!prev.reason && reason) prev.reason = reason
      return
    }
    found.set(user.id, { user: { ...user, isFollowing: false }, score, reason })
  }

  // 1. They follow you.
  ;(followersData?.users ?? []).forEach(u => add(u, 6, 'Follows you'))

  // 2. Friends of friends (a few of the people you follow most recently).
  const friends = following.slice(0, FRIENDS_TO_SCAN)
  const theirFollowing = await Promise.all(friends.map(f =>
    settle(api.get(`/users/${encodeURIComponent(f.username)}/following`, { params: { pageSize: 20 } }))
      .then(data => ({ friend: f, users: data?.users ?? [] }))))
  theirFollowing.forEach(({ friend, users }) =>
    users.forEach(u => add(u, 3, `Followed by @${friend.username}`)))

  // 3. Active people from the feed.
  ;(feedData?.posts ?? []).forEach(p => {
    const author = p.author
    if (!author) return
    const sameState = me.state && author.state === me.state
    add(author, sameState ? 2 : 1, sameState ? `Also in ${me.state}` : 'Active on NaijaCorper')
  })

  // A small boost for people in the same state and verified corps members.
  found.forEach(entry => {
    if (me.state && entry.user.state === me.state) entry.score += 1
    if (entry.user.isVerified) entry.score += 0.5
  })

  const list = [...found.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ user, reason }) => ({ ...user, suggestionReason: reason }))

  cache = { userId: me.id, at: Date.now(), list }
  return list.slice(0, limit)
}
