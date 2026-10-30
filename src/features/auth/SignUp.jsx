import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, AtSign, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import AuthHero from './AuthHero'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import './auth.css'

export default function SignUp() {
  const navigate = useNavigate()
  const { signIn } = useApp()
  const [showPw, setShowPw] = useState(false)
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => {
    const value = key === 'username' ? e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') : e.target.value
    setForm(f => ({ ...f, [key]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // The backend emails a 6-digit code and signs the new user in.
      const { data } = await api.post('/auth/register', form)
      await signIn(data.accessToken)
      navigate('/verify-email', { replace: true })
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
            <h2>Create your account</h2>
            <p>Join thousands of corps members across Nigeria.</p>
          </div>

          <form className="auth__form" onSubmit={handleSubmit}>
            <div className="auth__field">
              <label htmlFor="name">Full name</label>
              <div className="auth__input">
                <User size={18} />
                <input id="name" type="text" placeholder="e.g. Ada Obi" minLength={2} maxLength={80}
                  value={form.fullName} onChange={set('fullName')} required />
              </div>
            </div>

            <div className="auth__field">
              <label htmlFor="username">Username</label>
              <div className="auth__input">
                <AtSign size={18} />
                <input id="username" type="text" placeholder="e.g. ada_obi" minLength={3} maxLength={20}
                  value={form.username} onChange={set('username')} required />
              </div>
            </div>

            <div className="auth__field">
              <label htmlFor="email">Email address</label>
              <div className="auth__input">
                <Mail size={18} />
                <input id="email" type="email" placeholder="you@example.com"
                  value={form.email} onChange={set('email')} required />
              </div>
            </div>

            <div className="auth__field">
              <label htmlFor="password">Password</label>
              <div className="auth__input">
                <Lock size={18} />
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="8+ characters, upper & lower case and a number"
                  minLength={8}
                  maxLength={128}
                  value={form.password}
                  onChange={set('password')}
                  required
                />
                <button type="button" onClick={() => setShowPw(v => !v)} aria-label="Toggle password">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <label className="auth__terms">
              <input type="checkbox" required />
              I agree to the <Link to="/terms" className="auth__link">Terms of Service</Link> and{' '}
              <Link to="/privacy" className="auth__link">Privacy Policy</Link>.
            </label>

            {error && <p className="auth__error" role="alert">{error}</p>}

            <button type="submit" className="btn btn--primary auth__submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'} <ArrowRight size={17} />
            </button>
          </form>

          <p className="auth__alt">
            Already have an account? <Link to="/signin" className="auth__link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
