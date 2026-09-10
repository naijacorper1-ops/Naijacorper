import { Sparkles } from 'lucide-react'

/*
 * Left brand / info panel shared by Sign in & Sign up.
 * The Vision / Disclaimer / Contact blocks below are placeholders —
 * replace the paragraph text with the copy you provide.
 */
export default function AuthHero() {
  return (
    <div className="auth__hero">
      <div className="auth__brand">
        <span className="brand__mark">NC</span>
        <span className="brand__name">NaijaCorper</span>
      </div>

      <span className="auth__pill"><Sparkles size={14} /> Built for Nigerian corps members</span>

      <div className="auth__headline">
        <h1>Your service year,<span>finally connected.</span></h1>
        <p className="auth__lead">
          The social network for NYSC corps members — connect by state, find
          accommodation, sell your stuff, ask questions, attend events, and
          build your professional network.
        </p>
      </div>

      <div className="auth__info">
        <div className="auth__info-block">
          <h3>Our Vision</h3>
          <p>{/* TODO: paste vision text here */}Vision statement goes here.</p>
        </div>
        <div className="auth__info-block">
          <h3>Disclaimer</h3>
          <p>{/* TODO: paste disclaimer text here */}Disclaimer text goes here.</p>
        </div>
        <div className="auth__info-block">
          <h3>Contact</h3>
          <p>{/* TODO: paste contact details here */}Contact details go here.</p>
        </div>
      </div>

      <div className="auth__stats">
        <div className="auth__stat"><strong>36</strong><span>States covered</span></div>
        <div className="auth__stat"><strong>All</strong><span>NYSC batches</span></div>
        <div className="auth__stat"><strong>24/7</strong><span>Community</span></div>
      </div>
    </div>
  )
}
