import { io } from 'socket.io-client'
import { getAccessToken, refreshAccessToken } from './api'

// Real-time messaging over Socket.IO (backend namespace: /messaging).
//
// Dev: VITE_SOCKET_URL is empty, so the socket connects to the current origin
// and the Vite proxy forwards /socket.io (including the WebSocket upgrade).
// Production: Vercel rewrites cannot proxy WebSockets, so the socket talks to
// the API directly. The backend allows the FRONTEND_URL origins for this.
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL
  || (import.meta.env.PROD ? 'https://api.naijacorper.com' : '')).replace(/\/+$/, '')
const NAMESPACE = import.meta.env.VITE_SOCKET_NAMESPACE || '/messaging'
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/socket.io'

const ACK_TIMEOUT_MS = 10000 // how long to wait for the saved message after sendMessage
const MAX_AUTH_RETRIES = 5 // token refresh + reconnect attempts before leaving it to polling

let socket = null
let connected = false
let authRetries = 0
let retryTimer = null
let sendSeq = 0
const pending = new Map() // sends waiting for their acknowledgement
const statusListeners = new Set()
const messageListeners = new Set()

// Errors from this module carry a `code`:
//   NOT_CONNECTED  socket is down; nothing was sent, so sending over REST is safe
//   UNCONFIRMED    the message went out but no reply came; it may or may not be saved
//   REJECTED       the server refused it (rate limit, blocked user, bad input…)
class SocketSendError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
    this.isSocketError = true
  }
}

function setConnected(value) {
  if (connected === value) return
  connected = value
  statusListeners.forEach(fn => fn(value))
}

function failPending(code, message) {
  pending.forEach(p => { clearTimeout(p.timer); p.reject(new SocketSendError(code, message)) })
  pending.clear()
}

// NestJS sends errors as { status: 'error', message, cause?: { pattern, data } }.
function readableMessage(err) {
  const m = err?.message
  if (Array.isArray(m)) return m.join(' ')
  if (typeof m === 'string' && m) return m
  return 'Message could not be sent.'
}

function onException(err) {
  if (!pending.size) {
    console.warn('[socket] exception', err)
    return
  }
  // Prefer the send this error belongs to; otherwise blame the oldest one.
  const data = err?.cause?.data
  let key = null
  if (data) {
    for (const [k, p] of pending) {
      if (p.conversationId === data.conversationId && p.content === data.content) { key = k; break }
    }
  }
  if (key === null) key = pending.keys().next().value
  const p = pending.get(key)
  pending.delete(key)
  clearTimeout(p.timer)
  p.reject(new SocketSendError('REJECTED', readableMessage(err)))
}

// The access token lasts 15 minutes. When the server refuses the handshake,
// get a fresh token with the refresh cookie and connect again, backing off
// between attempts. If the session is gone, stop: REST polling keeps working
// and the API client signs the user out.
function reconnectWithFreshToken() {
  if (!socket || retryTimer || authRetries >= MAX_AUTH_RETRIES) return
  const delay = Math.min(30000, 1000 * 2 ** authRetries)
  authRetries += 1
  retryTimer = setTimeout(async () => {
    retryTimer = null
    if (!socket) return
    const ok = await refreshAccessToken()
    if (ok && socket && !socket.connected) socket.connect()
  }, delay)
}

// After giving up, try again when the user comes back to the tab or the
// network returns.
function retryOnReturn() {
  if (!socket || socket.connected || socket.active) return
  authRetries = 0
  reconnectWithFreshToken()
}

export function connectSocket() {
  if (socket) return
  authRetries = 0
  window.addEventListener('focus', retryOnReturn)
  window.addEventListener('online', retryOnReturn)
  socket = io(SOCKET_URL + NAMESPACE, {
    path: SOCKET_PATH,
    // A function, so every (re)connect sends the current token.
    auth: (cb) => cb({ token: getAccessToken() }),
    reconnectionDelayMax: 10000,
  })

  socket.on('connect', () => {
    authRetries = 0
    setConnected(true)
  })

  socket.on('disconnect', (reason) => {
    setConnected(false)
    failPending('UNCONFIRMED', 'Connection lost while sending.')
    // The server closed the connection itself; Socket.IO will not retry on its own.
    if (reason === 'io server disconnect') reconnectWithFreshToken()
  })

  socket.on('connect_error', () => {
    setConnected(false)
    // `active` is false when the server rejected the handshake (bad or expired
    // token). Network errors keep it true and Socket.IO retries by itself.
    if (socket && !socket.active) reconnectWithFreshToken()
  })

  socket.on('newMessage', (message) => {
    messageListeners.forEach(fn => fn(message))
  })

  socket.on('exception', onException)
}

export function disconnectSocket() {
  window.removeEventListener('focus', retryOnReturn)
  window.removeEventListener('online', retryOnReturn)
  clearTimeout(retryTimer)
  retryTimer = null
  if (!socket) return
  const s = socket
  socket = null
  failPending('UNCONFIRMED', 'Connection closed while sending.')
  s.removeAllListeners()
  s.disconnect()
  setConnected(false)
}

export function isSocketConnected() {
  return connected
}

// Both return an unsubscribe function.
export function onSocketStatus(fn) {
  statusListeners.add(fn)
  fn(connected)
  return () => statusListeners.delete(fn)
}

export function onNewMessage(fn) {
  messageListeners.add(fn)
  return () => messageListeners.delete(fn)
}

// Sends over the socket and resolves with the saved message from the
// acknowledgement. Rejects with a SocketSendError (see codes above).
export function sendMessageRealtime(conversationId, content) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new SocketSendError('NOT_CONNECTED', 'Not connected.'))
      return
    }
    const id = ++sendSeq
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new SocketSendError('UNCONFIRMED', 'No reply from the server.'))
    }, ACK_TIMEOUT_MS)
    pending.set(id, { conversationId, content, reject, timer })

    socket.emit('sendMessage', { conversationId, content }, (response) => {
      if (!pending.has(id)) return // already timed out or failed
      pending.delete(id)
      clearTimeout(timer)
      // A plain message, or wrapped as { event, data } by some gateways.
      const message = response?.id ? response : response?.data?.id ? response.data : null
      if (message) resolve(message)
      else reject(new SocketSendError('REJECTED', readableMessage(response)))
    })
  })
}
