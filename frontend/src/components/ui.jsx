import { ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from 'lucide-react'

// One place for colours/labels so every component speaks the same visual language.
export const DECISION_STYLE = {
  TRUSTED: { color: '#0e8f7e', tint: '#e2f4f1', Icon: ShieldCheck },
  'LIKELY TRUSTED': { color: '#3a9d6b', tint: '#e5f4ec', Icon: ShieldCheck },
  INCONCLUSIVE: { color: '#b87a00', tint: '#fbf0d6', Icon: ShieldQuestion },
  'HIGH RISK': { color: '#c0392b', tint: '#fbe6e3', Icon: ShieldAlert },
  'VERY HIGH RISK': { color: '#8e1b1b', tint: '#f6dcdc', Icon: ShieldX },
}

export const STATUS_STYLE = {
  SUPPORTED: { color: '#0e8f7e', tint: '#e2f4f1' },
  CONTRADICTED: { color: '#c0392b', tint: '#fbe6e3' },
  INCONCLUSIVE: { color: '#b87a00', tint: '#fbf0d6' },
  'NOT VERIFIED': { color: '#7a8498', tint: '#eceff4' },
}

export const CLASS_STYLE = {
  SUPPORTS: { color: '#0e8f7e', tint: '#e2f4f1', label: 'Supports' },
  CONTRADICTS: { color: '#c0392b', tint: '#fbe6e3', label: 'Contradicts' },
  NEUTRAL: { color: '#7a8498', tint: '#eceff4', label: 'Neutral' },
}

export const pct = (x) => (x == null ? '-' : `${Math.round(x * 100)}%`)

export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function Card({ children, className = '' }) {
  return <section className={`rounded-lg border border-line bg-white p-5 ${className}`}>{children}</section>
}

export function SectionTitle({ icon: Icon, children, aside }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
        {Icon && <Icon size={18} className="text-ink-soft" aria-hidden />}
        {children}
      </h2>
      {aside}
    </div>
  )
}

export function Chip({ color, tint, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${className}`}
      style={{ color, backgroundColor: tint }}
    >
      {children}
    </span>
  )
}

export function Meter({ value, color, label }) {
  return (
    <div role="img" aria-label={`${label}: ${Math.round(value * 100)}%`} className="h-2 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, backgroundColor: color }} />
    </div>
  )
}
