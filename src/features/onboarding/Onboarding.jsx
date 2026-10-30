import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Briefcase, CheckCircle2, ArrowRight, ArrowLeft, Search } from 'lucide-react'
import { api, errorMessage } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import PersonRow from '../../components/ui/PersonRow'
import {
  NIGERIAN_STATES, NYSC_STAGES, PROSPECTIVE_INTERESTS, SERVING_INTERESTS,
} from '../../lib/format'

const JOURNEYS = [
  { id: 'PREPARING', label: "I'm preparing for NYSC", icon: GraduationCap, desc: 'Waiting for mobilization, call-up or deployment.' },
  { id: 'SERVING', label: "I'm currently serving", icon: Briefcase, desc: 'You are at camp or at your PPA.' },
  { id: 'COMPLETED', label: "I've completed NYSC", icon: CheckCircle2, desc: 'You are an ex-corper. Stay in the community.' },
]

const STEPS = {
  PREPARING: ['journey', 'stage', 'state', 'interests', 'follow', 'first-post'],
  SERVING: ['journey', 'service', 'interests', 'follow', 'first-post'],
  COMPLETED: ['journey', 'state', 'follow', 'first-post'],
}

// The step after which the answers are sent to the backend.
const SAVE_AFTER = { PREPARING: 'interests', SERVING: 'interests', COMPLETED: 'state' }

export default function Onboarding() {
  const navigate = useNavigate()
  const { me, setMe, createPost, showToast } = useApp()

  const [step, setStep] = useState(0)
  const [journey, setJourney] = useState(null)
  const [stage, setStage] = useState(null)
  const [state, setState] = useState(me.state || '')
  const [service, setService] = useState({ lga: '', batch: '', stream: '', ppa: '' })
  const [interests, setInterests] = useState(new Set())
  const [firstPost, setFirstPost] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const steps = STEPS[journey] || ['journey']
  const currentKey = steps[step]
  const isLast = step === steps.length - 1 && !!journey
  const interestOptions = journey === 'SERVING' ? SERVING_INTERESTS : PROSPECTIVE_INTERESTS

  const toggleInterest = (i) => {
    setInterests(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const chooseJourney = (id) => {
    setJourney(id)
    setInterests(new Set()) // the two journeys use different interest lists
  }

  const canContinue = {
    journey: !!journey,
    stage: !!stage,
    service: !!state && service.lga.trim() && service.batch.trim() && service.stream.trim(),
    state: journey === 'COMPLETED' ? true : state !== null,
    interests: interests.size > 0,
    follow: true,
    'first-post': true,
  }[currentKey]

  const saveAnswers = async () => {
    await api.patch('/onboarding/journey-stage', { stage: journey })
    let updated
    if (journey === 'PREPARING') {
      ({ data: updated } = await api.patch('/onboarding/prospective-details', {
        nyscStage: stage,
        state: state || undefined,
        interests: [...interests],
      }))
    } else if (journey === 'SERVING') {
      ({ data: updated } = await api.patch('/onboarding/serving-details', {
        state,
        lga: service.lga.trim(),
        batch: service.batch.trim(),
        stream: service.stream.trim(),
        ppa: service.ppa.trim() || undefined,
        interests: [...interests],
      }))
    } else {
      ({ data: updated } = await api.patch('/users/me', state ? { state } : {}))
    }
    setMe(updated)
  }

  const next = async () => {
    setError('')
    if (currentKey === SAVE_AFTER[journey]) {
      setSaving(true)
      try {
        await saveAnswers()
      } catch (err) {
        setError(errorMessage(err))
        return
      } finally {
        setSaving(false)
      }
    }
    setStep(s => Math.min(s + 1, steps.length - 1))
  }
  const back = () => { setError(''); setStep(s => Math.max(s - 1, 0)) }

  const finish = async () => {
    if (firstPost.trim()) {
      setSaving(true)
      try {
        await createPost({ content: firstPost.trim() })
        showToast('Post shared 🎉')
      } catch (err) {
        setError(errorMessage(err))
        setSaving(false)
        return
      }
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="onboard">
      <div className="onboard__card">
        <div className="onboard__brand">
          <span className="brand__mark"><img src="/logo.png" alt="NaijaCorper logo" /></span>
          <span className="brand__name">NaijaCorper</span>
        </div>

        <div className="onboard__progress">
          {(journey ? steps : STEPS.PREPARING).map((s, i) => (
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
                  onClick={() => chooseJourney(id)}
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
              {NYSC_STAGES.map(s => (
                <button key={s.value} className={`opt ${stage === s.value ? 'opt--on' : ''}`} onClick={() => setStage(s.value)}>
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}

        {currentKey === 'state' && (
          <>
            <h1 className="onboard__title">
              {journey === 'COMPLETED' ? 'Which state are you in?' : 'Which state are you expecting?'}
            </h1>
            <p className="onboard__sub">Pick one, or choose “I don't know yet”.</p>
            <div className="state-grid">
              {NIGERIAN_STATES.map(s => (
                <button key={s} className={`chip ${state === s ? 'chip--active' : ''}`} onClick={() => setState(s)}>
                  {s}
                </button>
              ))}
              <button className={`chip ${state === '' ? 'chip--active' : ''}`} onClick={() => setState('')}>
                I don't know yet
              </button>
            </div>
          </>
        )}

        {currentKey === 'service' && (
          <>
            <h1 className="onboard__title">Your service information</h1>
            <p className="onboard__sub">State, LGA, batch and stream are needed. PPA is optional.</p>
            <div className="form-grid">
              <label className="field"><span>State</span>
                <select value={state} onChange={(e) => setState(e.target.value)}>
                  <option value="">Select state</option>
                  {NIGERIAN_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="field"><span>LGA</span>
                <input placeholder="e.g. Yaba" maxLength={80} value={service.lga}
                  onChange={(e) => setService({ ...service, lga: e.target.value })} />
              </label>
              <label className="field"><span>Batch</span>
                <input placeholder="e.g. 2026 Batch B" maxLength={20} value={service.batch}
                  onChange={(e) => setService({ ...service, batch: e.target.value })} />
              </label>
              <label className="field"><span>Stream</span>
                <input placeholder="e.g. Stream 1" maxLength={20} value={service.stream}
                  onChange={(e) => setService({ ...service, stream: e.target.value })} />
              </label>
              <label className="field"><span>PPA (optional)</span>
                <input placeholder="Place of primary assignment" maxLength={120} value={service.ppa}
                  onChange={(e) => setService({ ...service, ppa: e.target.value })} />
              </label>
            </div>
            <p className="onboard__hint">🔒 LGA and PPA stay private. Other people never see them.</p>
          </>
        )}

        {currentKey === 'interests' && (
          <>
            <h1 className="onboard__title">What are you interested in?</h1>
            <p className="onboard__sub">Choose a few — we'll tune your feed. ({interests.size} selected)</p>
            <div className="interest-grid">
              {interestOptions.map(i => (
                <button
                  key={i.value}
                  className={`chip ${interests.has(i.value) ? 'chip--active' : ''}`}
                  onClick={() => toggleInterest(i.value)}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </>
        )}

        {currentKey === 'follow' && <FindPeople />}

        {currentKey === 'first-post' && (
          <>
            <h1 className="onboard__title">Introduce yourself</h1>
            <p className="onboard__sub">Optional — tell the community a little about you.</p>
            <textarea
              className="onboard__textarea"
              rows={4}
              maxLength={2000}
              placeholder={`e.g. I'm ${me.fullName.split(' ')[0]}, a software developer serving in Lagos. Looking to connect with other tech corps members.`}
              value={firstPost}
              onChange={(e) => setFirstPost(e.target.value)}
            />
          </>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="onboard__actions">
          {step > 0
            ? <button className="btn btn--ghost" onClick={back} disabled={saving}><ArrowLeft size={16} /> Back</button>
            : <button className="btn btn--ghost" onClick={() => navigate('/', { replace: true })}>Skip for now</button>}

          {isLast ? (
            <div className="onboard__finish">
              <button className="btn btn--ghost" onClick={() => navigate('/', { replace: true })}>Skip</button>
              <button className="btn btn--primary" onClick={finish} disabled={saving}>
                Enter the community <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <button className="btn btn--primary" disabled={!canContinue || saving} onClick={next}>
              {saving ? 'Saving…' : 'Continue'} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// The backend has no "suggested people" list, so new members search instead.
function FindPeople() {
  const [q, setQ] = useState('')
  const [people, setPeople] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const text = q.trim()
    if (text.length < 2) return undefined
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await api.get('/users/search', { params: { q: text } })
        setPeople(data.users)
      } catch {
        setPeople([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const shown = q.trim().length >= 2 ? people : []

  return (
    <>
      <h1 className="onboard__title">Find people to follow</h1>
      <p className="onboard__sub">Following is optional — it just helps fill your feed.</p>
      <label className="msg-search onboard__search">
        <Search size={15} />
        <input placeholder="Search by name or username" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="follow-suggest">
        {shown.map(u => <PersonRow key={u.id} user={u} />)}
        {q.trim().length >= 2 && !searching && shown.length === 0 && <div className="empty">No one found.</div>}
      </div>
    </>
  )
}
