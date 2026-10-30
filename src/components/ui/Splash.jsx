import { useEffect, useState } from 'react'

// Shown while we check for a saved session. The backend (on Render) can take
// up to a minute to wake up after a quiet period, so say so instead of
// showing an empty page.
export default function Splash() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
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
