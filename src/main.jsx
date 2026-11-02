import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import Splash from './components/ui/Splash'
import { AppProvider } from './context/AppContext'
import './index.css'
import { api, refreshAccessToken } from './lib/api'

const root = ReactDOM.createRoot(document.getElementById('root'))

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
