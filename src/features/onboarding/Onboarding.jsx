import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Briefcase, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react'
import {
  nyscStages, nigerianStates, interestOptions, suggested, users, currentUser,
} from '../../data/mock'
import { useApp } from '../../context/AppContext'

const JOURNEYS = [
  { id: 'preparing', label: "I'm preparing for NYSC", icon: GraduationCap, desc: 'Waiting for mobilization, call-up or deployment.' },
  { id: 'serving', label: "I'm currently serving", icon: Briefcase, desc: 'You are at camp or at your PPA.' },
  { id: 'completed', label: "I've completed NYSC", icon: CheckCircle2, desc: 'You are an ex-corper. Stay in the community.' },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { toggleFollow, following, addPost } = useApp()

  const [step, setStep] = useState(0)
  const [journey, setJourney] = useState(null)
  const [stage, setStage] = useState(null)
  const [state, setState] = useState(null)
  const [interests, setInterests] = useState(new Set())
  const [firstPost, setFirstPost] = useState('')

  // steps differ slightly by journey but share the shell
  const steps = journey === 'serving'
    ? ['journey', 'service', 'interests', 'follow', 'first-post']
    : ['journey', 'stage', 'state', 'interests', 'follow', 'first-post']
  const currentKey = steps[step]
  const isLast = step === steps.length - 1

  const toggleInterest = (i) => {
    setInterests(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const next = () => setStep(s => Math.min(s + 1, steps.length - 1))
  const back = () => setStep(s => Math.max(s - 1, 0))

  const canContinue = {
    journey: !!journey,
    stage: !!stage,
    service: true,
    state: !!state,
    interests: interests.size > 0,
    follow: true,
    'first-post': true,
  }[currentKey]

  const finish = () => {
    if (firstPost.trim()) addPost(firstPost)
    navigate('/')
  }

  return (
    <div className="onboard">
      <div className="onboard__card">
        <div className="onboard__brand">
          <span className="brand__mark"><img src="/logo.png" alt="NaijaCorper logo" /></span>
          <span className="brand__name">NaijaCorper</span>
        </div>

        <div className="onboard__progress">
          {steps.map((s, i) => (
            <span key={s} className={`onboard__dot ${i <= step ? 'onboard__dot--on' : ''}`} />
          ))}
        </div>

        {currentKey === 'journey' && (
          <>
            <h1 className="onboard__title">Where are you in your NYSC journey?</h1>
            <p className="onboard__sub">This personalizes your experience. You can change it later.</p>
            <div className="journey-grid">
              {JOURNEYS.map(({ id, label, icon: Icon, desc }) => (
                <button
                  key={id}
                  className={`journey ${journey === id ? 'journey--on' : ''}`}
                  onClick={() => setJourney(id)}
                >
                  <span className="journey__icon"><Icon size={26} /></span>
                  <span className="journey__label">{label}</span>
                  <span className="journey__desc">{desc}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {currentKey === 'stage' && (
          <>
            <h1 className="onboard__title">What's your NYSC stage?</h1>
            <p className="onboard__sub">Helps us show the most relevant conversations.</p>
            <div className="opt-list">
              {nyscStages.map(s => (
                <button key={s} className={`opt ${stage === s ? 'opt--on' : ''}`} onClick={() => setStage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {currentKey === 'state' && (
          <>
            <h1 className="onboard__title">Which state are you expecting?</h1>
            <p className="onboard__sub">Pick one, or choose “I don't know yet”.</p>
            <div className="state-grid">
              {nigerianStates.map(s => (
                <button key={s} className={`chip ${state === s ? 'chip--active' : ''}`} onClick={() => setState(s)}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {currentKey === 'service' && (
          <>
            <h1 className="onboard__title">Your service information</h1>
            <p className="onboard__sub">Optional — you can complete this later from your profile.</p>
            <div className="form-grid">
              <label className="field"><span>State</span>
                <select value={state || ''} onChange={(e) => setState(e.target.value)}>
                  <option value="">Select state</option>
                  {nigerianStates.slice(0, -1).map(s => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="field"><span>LGA</span><input placeholder="e.g. Yaba" /></label>
              <label className="field"><span>Batch / Stream</span><input placeholder="e.g. 2026 Batch B, Stream 1" /></label>
              <label className="field"><span>PPA (optional)</span><input placeholder="Place of primary assignment" /></label>
            </div>
            <p className="onboard__hint">🔒 PPA and sensitive service info stay private by default.</p>
          </>
        )}

        {currentKey === 'interests' && (
          <>
            <h1 className="onboard__title">What are you interested in?</h1>
            <p className="onboard__sub">Choose a few — we'll tune your feed. ({interests.size} selected)</p>
            <div className="interest-grid">
              {interestOptions.map(i => (
                <button
                  key={i}
                  className={`chip ${interests.has(i) ? 'chip--active' : ''}`}
                  onClick={() => toggleInterest(i)}
                >
                  {i}
                </button>
              ))}
            </div>
          </>
        )}

        {currentKey === 'follow' && (
          <>
            <h1 className="onboard__title">People to follow</h1>
            <p className="onboard__sub">Following is optional — it just helps fill your feed.</p>
            <div className="follow-suggest">
              {suggested.map(h => {
                const u = users[h]
                const isF = following.has(h)
                return (
                  <div key={h} className="follow-row follow-row--card">
                    <div className="avatar">{u.avatar}</div>
                    <div className="follow-row__info">
                      <span className="follow-row__name">{u.name}</span>
                      <span className="follow-row__sub">{u.handle} · {u.profession}</span>
                    </div>
                    <button
                      className={`btn btn--sm ${isF ? 'btn--ghost' : 'btn--primary'}`}
                      onClick={() => toggleFollow(h)}
                    >
                      {isF ? 'Following' : 'Follow'}
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {currentKey === 'first-post' && (
          <>
            <h1 className="onboard__title">Introduce yourself</h1>
            <p className="onboard__sub">Optional — tell the community a little about you.</p>
            <textarea
              className="onboard__textarea"
              rows={4}
              placeholder={`e.g. I'm ${currentUser.name.split(' ')[0]}, a software developer serving in Lagos. Looking to connect with other tech corps members.`}
              value={firstPost}
              onChange={(e) => setFirstPost(e.target.value)}
            />
          </>
        )}

        <div className="onboard__actions">
          {step > 0
            ? <button className="btn btn--ghost" onClick={back}><ArrowLeft size={16} /> Back</button>
            : <span />}

          {isLast ? (
            <div className="onboard__finish">
              <button className="btn btn--ghost" onClick={() => navigate('/')}>Skip</button>
              <button className="btn btn--primary" onClick={finish}>Enter the community <ArrowRight size={16} /></button>
            </div>
          ) : (
            <button className="btn btn--primary" disabled={!canContinue} onClick={next}>
              Continue <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
