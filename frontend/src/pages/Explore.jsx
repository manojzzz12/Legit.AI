import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'
import { FEATURES } from '../features.js'

export default function Explore({ onNavigate }) {
  return (
    <div className="explore-content">
      <a href="/" className="back-link" onClick={(event) => onNavigate(event, '/')}>
        <ArrowLeft size={15} aria-hidden /> Back to home
      </a>

      <section className="explore-intro">
        <span className="hero-kicker">LEGIT.AI TOOLKIT</span>
        <h1>Choose what you’d like<br /><span>to check.</span></h1>
        <p>Pick a format to open its dedicated workspace. Add content, run an analysis, and review the evidence.</p>
      </section>

      <section className="explore-tools" aria-label="Available features">
        {FEATURES.map(({ href, title, description, Icon, color }, index) => (
          <a key={href} href={href} className={`explore-tool-card explore-${color}`} onClick={(event) => onNavigate(event, href)}>
            <span className="explore-tool-top"><span className="explore-tool-icon"><Icon size={23} aria-hidden /></span><span>FEATURE 0{index + 1}</span></span>
            <strong>{title}</strong>
            <span className="explore-tool-description">{description}</span>
            <span className="explore-tool-open">Open feature <ArrowRight size={16} aria-hidden /></span>
          </a>
        ))}
      </section>

      <div className="trust-note"><ShieldCheck size={18} aria-hidden /><span><strong>Evidence can be incomplete.</strong> Analysis results are a helpful signal, not proof of authenticity.</span></div>
    </div>
  )
}
