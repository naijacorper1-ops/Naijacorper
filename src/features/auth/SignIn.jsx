import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import AuthHero from './AuthHero'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import './auth.css'

export default function SignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useApp()
  const [showPw, setShowPw] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      await signIn(data.accessToken)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth">
      <AuthHero variant="signup" />

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
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowPw(v => !v)} aria-label="Toggle password">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="auth__row">
              <span />
              <Link to="/forgot-password" className="auth__link">Forgot password?</Link>
            </div>

            {error && <p className="auth__error" role="alert">{error}</p>}

            <button type="submit" className="btn btn--primary auth__submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} />
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
