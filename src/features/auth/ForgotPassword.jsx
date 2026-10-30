import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, KeyRound, Lock, ArrowRight } from 'lucide-react'
import AuthHero from './AuthHero'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import './auth.css'

// Two steps: ask for a code by email, then set a new password with it.
export default function ForgotPassword() {
  const navigate = useNavigate()
  const { showToast } = useApp()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const run = (fn) => async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try { await fn() } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) }
  }

  const sendCode = run(async () => {
    await api.post('/auth/forgot-password', { email })
    setStep('reset')
  })

  const reset = run(async () => {
    await api.post('/auth/reset-password', { email, code, newPassword })
    showToast('Password changed. Please sign in.')
    navigate('/signin', { replace: true })
  })

  return (
    <div className="auth">
      <AuthHero variant="signup" />
      <div className="auth__panel">
        <div className="auth__card">
          <div className="auth__card-head">
            <h2>Reset your password</h2>
            <p>{step === 'email'
              ? "Enter your email and we'll send you a 6-digit code."
              : `If ${email} has an account, a code is on its way.`}</p>
          </div>

          {step === 'email' ? (
            <form className="auth__form" onSubmit={sendCode}>
              <div className="auth__field">
                <label htmlFor="email">Email address</label>
                <div className="auth__input">
                  <Mail size={18} />
                  <input id="email" type="email" placeholder="you@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              {error && <p className="auth__error" role="alert">{error}</p>}
              <button type="submit" className="btn btn--primary auth__submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send code'} <ArrowRight size={17} />
              </button>
            </form>
          ) : (
            <form className="auth__form" onSubmit={reset}>
              <div className="auth__field">
                <label htmlFor="code">Code from the email</label>
                <div className="auth__input">
                  <KeyRound size={18} />
                  <input id="code" inputMode="numeric" maxLength={6} placeholder="123456"
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
                </div>
              </div>
              <div className="auth__field">
                <label htmlFor="password">New password</label>
                <div className="auth__input">
                  <Lock size={18} />
                  <input id="password" type="password" minLength={8} maxLength={128}
                    placeholder="8+ characters, upper & lower case and a number"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
              </div>
              {error && <p className="auth__error" role="alert">{error}</p>}
              <button type="submit" className="btn btn--primary auth__submit" disabled={loading || code.length !== 6}>
                {loading ? 'Saving…' : 'Set new password'} <ArrowRight size={17} />
              </button>
            </form>
          )}

          <p className="auth__alt">
            Remembered it? <Link to="/signin" className="auth__link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
