import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import AuthHero from './AuthHero'
import './auth.css'

export default function SignIn() {
  const navigate = useNavigate()
  const [showPw, setShowPw] = useState(false)

  // Frontend only — no data is stored. Backend wires this up later.
  const handleSubmit = (e) => {
    e.preventDefault()
    navigate('/')
  }

  return (
    <div className="auth">
      <AuthHero />

      <div className="auth__panel">
        <div className="auth__card">
          <div className="auth__card-head">
            <h2>Welcome back</h2>
            <p>Sign in to continue to your community.</p>
          </div>

          <form className="auth__form" onSubmit={handleSubmit}>
            <div className="auth__field">
              <label htmlFor="email">Email address</label>
              <div className="auth__input">
                <Mail size={18} />
                <input id="email" type="email" placeholder="you@example.com" required />
              </div>
            </div>

            <div className="auth__field">
              <label htmlFor="password">Password</label>
              <div className="auth__input">
                <Lock size={18} />
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password"
                  required
                />
                <button type="button" onClick={() => setShowPw(v => !v)} aria-label="Toggle password">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="auth__row">
              <label className="auth__check">
                <input type="checkbox" /> Remember me
              </label>
              <Link to="/forgot-password" className="auth__link">Forgot password?</Link>
            </div>

            <button type="submit" className="btn btn--primary auth__submit">
              Sign in <ArrowRight size={17} />
            </button>

            <div className="auth__divider">or</div>

            <button type="button" className="auth__social">
              <GoogleIcon /> Continue with Google
            </button>
          </form>

          <p className="auth__alt">
            New to NaijaCorper? <Link to="/signup" className="auth__link">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 4.4 29.3 2.5 24 2.5 12.1 2.5 2.5 12.1 2.5 24S12.1 45.5 24 45.5 45.5 35.9 45.5 24c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M5.3 14.7l6.6 4.8C13.7 15.1 18.5 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 4.4 29.3 2.5 24 2.5 16 2.5 9 7.1 5.3 14.7z"/>
      <path fill="#4CAF50" d="M24 45.5c5.2 0 9.9-1.8 13.5-4.9l-6.2-5.3c-2 1.5-4.6 2.4-7.3 2.4-5.2 0-9.6-3.3-11.2-8l-6.6 5.1C9 40.8 16 45.5 24 45.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.4l6.2 5.3c-.4.4 6.8-4.9 6.8-14.7 0-1.2-.1-2.4-.7-3.5z"/>
    </svg>
  )
}
