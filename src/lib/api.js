import axios from 'axios'

// Base URL comes from .env.local (VITE_API_BASE_URL). Locally it is /api/v1,
// which the Vite dev server (and Vercel in production) forwards to
// https://api.naijacorper.com/api/v1.
let accessToken = null

export function setAccessToken(token) {
  accessToken = token
}

export function hasAccessToken() {
  return !!accessToken
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // lets the browser send the refresh cookie
})

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

// Gets a new access token using the refresh cookie. Returns true on success.
// Several requests can expire at the same moment; they share one refresh call,
// because each refresh replaces the cookie and a second parallel call would
// be using an old one.
let refreshing = null
export function refreshAccessToken() {
  if (!refreshing) {
    refreshing = api.post('/auth/refresh')
      .then(({ data }) => { setAccessToken(data.accessToken); return true })
      .catch(() => { setAccessToken(null); return false })
      .finally(() => { refreshing = null })
  }
  return refreshing
}

// Called when the session is gone for good (refresh failed). AppContext sets it.
let onSessionExpired = () => {}
export function setOnSessionExpired(fn) {
  onSessionExpired = fn
}

// If a request comes back 401 (token expired), refresh once and retry it.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const isAuthCall = original?.url?.startsWith('/auth/')
    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true
      if (await refreshAccessToken()) {
        original.headers.Authorization = `Bearer ${accessToken}`
        return api(original)
      }
      onSessionExpired()
    }
    return Promise.reject(error)
  },
)

// Turns an API error into one readable sentence for the UI.
export function errorMessage(err) {
  if (isEmailNotVerified(err)) return 'Please verify your email first. Check your inbox for the 6-digit code.'
  if (err?.response?.status === 429) return 'Too many tries. Please wait a moment and try again.'
  const message = err?.response?.data?.message
  if (Array.isArray(message)) return message.join(' ')
  if (typeof message === 'string') return message
  if (!err?.response) return 'Could not reach the server. Check your connection.'
  return 'Something went wrong. Please try again.'
}

export function isEmailNotVerified(err) {
  return err?.response?.status === 403 && err?.response?.data?.code === 'EMAIL_NOT_VERIFIED'
}

// Multipart upload with the file in a field named "file". Returns the JSON body.
export async function uploadFile(path, file, extraFields = {}, method = 'post') {
  const form = new FormData()
  form.append('file', file)
  Object.entries(extraFields).forEach(([k, v]) => { if (v !== undefined && v !== '') form.append(k, v) })
  const { data } = await api.request({ url: path, method, data: form })
  return data
}
