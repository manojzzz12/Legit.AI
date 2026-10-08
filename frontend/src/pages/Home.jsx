import { useState } from 'react'
import { ArrowRight, AudioLines, Check, FileText, Image as ImageIcon, Play, ShieldCheck, Video, Zap } from 'lucide-react'
import { FEATURES } from '../features.js'

const DEMO_ICONS = { text: FileText, image: ImageIcon, video: Video, audio: AudioLines }

export default function Home({ demos, loading, activeDemo, onDemo, onNavigate }) {
  const [activeFormat, setActiveFormat] = useState(FEATURES[0])
  return (
    <div className="home-content">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-kicker"><Zap size={14} aria-hidden /> YOUR EVERYDAY FACT-CHECKER</span>
          <h1>Pause the scroll.<br /><span>Check what’s real.</span></h1>
          <p>Bring a claim, image, or video. We’ll help you see what the available evidence says.</p>
          <a href="/explore" className="hero-cta" onClick={(e) => onNavigate(e, '/explore')}>Explore features <ArrowRight size={17} aria-hidden /></a>
        </div>
        <div className="scan-console">
          <div className="console-topline"><span><i /> LIVE CHECK</span><span>LEGIT.AI / 01</span></div>
          <div className="console-prompt">Choose what you want to verify</div>
          <div className="console-formats" role="group" aria-label="Choose content format">
            {FEATURES.map(({ href, shortLabel, Icon }) => {
              const selected = activeFormat.href === href
              return (
                <button
                  key={href}
                  type="button"
                  className={`console-format ${selected ? 'console-format-active' : ''}`}
                  aria-pressed={selected}
                  onClick={() => setActiveFormat(FEATURES.find((item) => item.href === href))}
                >
                  <Icon size={15} aria-hidden /> {shortLabel}
                </button>
              )
            })}
          </div>
          <div className="console-status" aria-live="polite">
            <span className="console-status-icon"><activeFormat.Icon size={17} aria-hidden /></span>
            <span className="console-status-copy"><strong>{activeFormat.signal}</strong><span>Ready when you are</span></span>
            <span className="console-ready"><Check size={13} /> Ready</span>
          </div>
          <a className="console-action" href="/explore" onClick={(e) => onNavigate(e, '/explore')}>
            Explore all features <ArrowRight size={15} aria-hidden />
          </a>
          <div className="console-footer"><span className="console-pulse" /> Private, evidence-led checks</div>
        </div>
        <div className="hero-footnote"><span className="hero-footnote-dot" /> Evidence-led. Transparent. Never a substitute for your judgment.</div>
      </section>

      <section className="demo-section">
        <div className="section-heading">
          <div><span className="eyebrow">TAKE A QUICK LOOK</span><h2>Explore a sample check</h2></div>
          <span className="demo-badge"><Play size={12} fill="currentColor" aria-hidden /> SIMULATED</span>
        </div>
        <div className="demo-grid">
          {demos.map((demo, index) => {
            const Icon = DEMO_ICONS[demo.input_type] || FileText
            const active = activeDemo === demo.id
            return (
              <button type="button" key={demo.id} className={`demo-card ${active ? 'demo-card-active' : ''}`} disabled={loading} onClick={() => onDemo(demo.id)}>
                <span className="demo-card-top"><span className="demo-card-icon"><Icon size={17} aria-hidden /></span><span>CASE 0{index + 1}</span></span>
                <strong>{demo.label}</strong>
                <span className="demo-description">{demo.tagline}</span>
                <span className="demo-open">{active && loading ? 'Opening…' : 'Open sample'} <ArrowRight size={15} aria-hidden /></span>
              </button>
            )
          })}
          {demos.length === 0 && <p className="empty-demo">Loading sample checks…</p>}
        </div>
      </section>

      <div className="trust-note"><ShieldCheck size={18} aria-hidden /><span><strong>A helpful signal, not a final verdict.</strong> Scores reflect the available evidence and may be incomplete or wrong.</span></div>
    </div>
  )
}
