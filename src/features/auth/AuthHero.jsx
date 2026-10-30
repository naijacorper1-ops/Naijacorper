import { Sparkles, MapPin, Home, Users, Mail } from 'lucide-react'

/*
 * Left brand / info panel shared by Sign in & Sign up.
 * - variant "signin" (default): minimal — headline, short points, stats.
 * - variant "signup": shows Vision / Disclaimer / Contact.
 */
export default function AuthHero({ variant = 'signin' }) {
  return (
    <div className="auth__hero">
      <div className="auth__brand">
        <span className="brand__mark"><img src="/logo.png" alt="NaijaCorper logo" /></span>
        <span className="brand__name">NaijaCorper</span>
      </div>

      <span className="auth__pill"><Sparkles size={14} /> Built for Nigerian corps members</span>

      <div className="auth__headline">
        <h1>Your service year,<span>finally connected.</span></h1>
        <p className="auth__lead">
          The social network for NYSC corps members. Connect, get answers,
          and build your network across all 36 states.
        </p>
      </div>

      {variant === 'signup' ? (
        <div className="auth__info">
          <div className="auth__info-block">
            <h3>Our Vision</h3>
            <p>
              Making the NYSC journey easier, safer, and more connected through
              trusted information, opportunities, and community — empowering
              corpers to make better decisions and thrive throughout their
              service year.
            </p>
          </div>

          <div className="auth__info-block">
            <h3>Disclaimer</h3>
            <p>
              NaijaCorper is an independent platform and is not affiliated with
              NYSC or any government agency. We strive to keep information
              accurate, but users should verify details and exercise caution
              with third parties.
            </p>
          </div>

          <div className="auth__info-block">
            <h3>Contact</h3>
            <div className="auth__contact">
              <a href="mailto:naijacorper1@gmail.com" className="auth__contact-item">
                <Mail size={18} /> naijacorper1@gmail.com
              </a>
              <a
                href="https://chat.whatsapp.com/ESk66ATGefx3utu6ckR2Xu?s=cl&p=a&mlu=4&ilr=4"
                target="_blank"
                rel="noopener noreferrer"
                className="auth__contact-item"
              >
                <WhatsAppIcon /> Join our WhatsApp community
              </a>
              <a
                href="https://x.com/Naija_corper"
                target="_blank"
                rel="noopener noreferrer"
                className="auth__contact-item"
              >
                <XIcon /> @Naija_corper
              </a>
              <a
                href="https://www.linkedin.com/in/trustelix-technologies-1b46413b9"
                target="_blank"
                rel="noopener noreferrer"
                className="auth__contact-item"
                aria-label="LinkedIn"
              >
                <LinkedInIcon /> LinkedIn
              </a>
            </div>
          </div>
        </div>
      ) : (
        <>
          <ul className="auth__points">
            <li><MapPin size={18} /> Connect with corps members in your state</li>
            <li><Home size={18} /> Find trusted accommodation &amp; PPA reviews</li>
            <li><Users size={18} /> Join the community &amp; grow your network</li>
          </ul>

          <div className="auth__stats">
            <div className="auth__stat"><strong>36</strong><span>States covered</span></div>
            <div className="auth__stat"><strong>All</strong><span>NYSC batches</span></div>
            <div className="auth__stat"><strong>24/7</strong><span>Community</span></div>
          </div>

          <p className="auth__fineprint">
            By continuing you agree to our Terms of Service and Privacy Policy.
          </p>
        </>
      )}
    </div>
  )
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2zm0 18.13c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.14.82.84-3.06-.2-.31a8.2 8.2 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23 4.53 0 8.23 3.69 8.23 8.23s-3.7 8.24-8.24 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.98-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43-.14-.01-.31-.01-.48-.01-.16 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.16 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/>
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 1.5h3.68l-8.04 9.19L24 22.5h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.5h7.6l5.24 6.93L18.9 1.5zm-1.29 18.8h2.04L6.48 3.6H4.29l13.32 16.7z"/>
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/>
    </svg>
  )
}
