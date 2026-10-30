import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound, ArrowRight } from 'lucide-react'
import AuthHero from './AuthHero'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { JOURNEY_ROLES } from '../../lib/format'
import './auth.css'

// Shown right after sign-up, and from the "verify your email" banner.
export default function VerifyEmail() {
  const navigate = useNavigate()
  const { me, refreshMe, showToast } = useApp()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  // New accounts continue to onboarding; everyone else goes home.
  const nextPage = !me.onboardingCompleted && JOURNEY_ROLES.includes(me.role) ? '/onboarding' : '/'

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/verify-email', { email: me.email, code })
      await refreshMe()
      showToast('Email verified ✓')
      navigate(nextPage, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    setResending(true)
    setError('')
    try {
      await api.post('/auth/resend-verification', { email: me.email })
      showToast('New code sent. Check your inbox.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setResending(false)
    }
  }

  if (me.emailVerified) {
    return (
      <div className="auth">
        <AuthHero variant="signup" />
        <div className="auth__panel">
          <div className="auth__card">
            <div className="auth__card-head">
              <h2>Your email is verified</h2>
              <p>{me.email}</p>
            </div>
            <Link to={nextPage} className="btn btn--primary auth__submit">Continue <ArrowRight size={17} /></Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth">
      <AuthHero variant="signup" />

      <div className="auth__panel">
        <div className="auth__card">
          <div className="auth__card-head">
            <h2>Check your email</h2>
            <p>We sent a 6-digit code to <strong>{me.email}</strong>. It lasts 15 minutes.</p>
          </div>

          <form className="auth__form" onSubmit={submit}>
            <div className="auth__field">
              <label htmlFor="code">Verification code</label>
              <div className="auth__input">
                <KeyRound size={18} />
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
            </div>

            {error && <p className="auth__error" role="alert">{error}</p>}

            <button type="submit" className="btn btn--primary auth__submit" disabled={loading || code.length !== 6}>
              {loading ? 'Checking…' : 'Verify email'} <ArrowRight size={17} />
            </button>
          </form>

          <p className="auth__alt">
            Didn't get it?{' '}
            <button type="button" className="auth__link link-btn" onClick={resend} disabled={resending}>
              {resending ? 'Sending…' : 'Send a new code'}
            </button>
            {' · '}
            <Link to={nextPage} className="auth__link">Do this later</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
