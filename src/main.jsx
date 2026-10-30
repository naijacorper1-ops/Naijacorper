import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AppProvider } from './context/AppContext'
import './index.css'
import { api, refreshAccessToken } from './lib/api'

const root = ReactDOM.createRoot(document.getElementById('root'))

// Shown while we check for a saved session. The backend (on Render) can take
// up to a minute to wake up after a quiet period, so say so instead of
// showing an empty page.
function Splash() {
  const [slow, setSlow] = React.useState(false)
  React.useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="splash">
      <img src="/logo.png" alt="" width="64" height="64" />
      <p>Connecting to NaijaCorper…</p>
      {slow && <p className="splash__hint">The server is waking up. This can take up to a minute the first time.</p>}
    </div>
  )
}

root.render(<Splash />)

// Try to restore a signed-in session. If there is no valid refresh cookie,
// or the server doesn't answer within 60 seconds, the user starts signed out.
async function loadSession() {
  if (!(await refreshAccessToken())) return null
  try {
    const { data } = await api.get('/users/me')
    return data
  } catch {
    return null
  }
}

const giveUp = new Promise(resolve => setTimeout(() => resolve(null), 60000))

Promise.race([loadSession(), giveUp]).then((user) => {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <AppProvider initialUser={user}>
          <App />
        </AppProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
})
