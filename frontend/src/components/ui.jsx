import { useEffect, useState } from 'react'
import { ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from 'lucide-react'

// One place for colours/labels so every component speaks the same visual language.
export const DECISION_STYLE = {
  TRUSTED: {
    color: '#0e8f7e',
    tint: '#e2f4f1',
    border: '#a4dece',
    glow: 'rgba(14, 143, 126, 0.15)',
    Icon: ShieldCheck,
    label: 'TRUSTED',
    badgeClass: 'badge-trusted',
  },
  'LIKELY TRUSTED': {
    color: '#3a9d6b',
    tint: '#e5f4ec',
    border: '#b1e2ca',
    glow: 'rgba(58, 157, 107, 0.15)',
    Icon: ShieldCheck,
    label: 'LIKELY TRUSTED',
    badgeClass: 'badge-likely',
  },
  INCONCLUSIVE: {
    color: '#b87a00',
    tint: '#fbf0d6',
    border: '#ebd399',
    glow: 'rgba(184, 122, 0, 0.15)',
    Icon: ShieldQuestion,
    label: 'INCONCLUSIVE',
    badgeClass: 'badge-inconclusive',
  },
  'HIGH RISK': {
    color: '#c0392b',
    tint: '#fbe6e3',
    border: '#f5b5ad',
    glow: 'rgba(192, 57, 43, 0.15)',
    Icon: ShieldAlert,
    label: 'HIGH RISK',
    badgeClass: 'badge-risk',
  },
  'VERY HIGH RISK': {
    color: '#8e1b1b',
    tint: '#f6dcdc',
    border: '#e8a8a8',
    glow: 'rgba(142, 27, 27, 0.15)',
    Icon: ShieldX,
    label: 'VERY HIGH RISK',
    badgeClass: 'badge-deep-risk',
  },
}

export const STATUS_STYLE = {
  SUPPORTED: { color: '#0e8f7e', tint: '#e2f4f1', border: '#a4dece', label: 'SUPPORTED' },
  CONTRADICTED: { color: '#c0392b', tint: '#fbe6e3', border: '#f5b5ad', label: 'CONTRADICTED' },
  INCONCLUSIVE: { color: '#b87a00', tint: '#fbf0d6', border: '#ebd399', label: 'UNCERTAIN' },
  'NOT VERIFIED': { color: '#7a8498', tint: '#eceff4', border: '#d5dae2', label: 'UNVERIFIED' },
}

export const CLASS_STYLE = {
  SUPPORTS: { color: '#0e8f7e', tint: '#e2f4f1', border: '#a4dece', label: 'Supports' },
  CONTRADICTS: { color: '#c0392b', tint: '#fbe6e3', border: '#f5b5ad', label: 'Contradicts' },
  NEUTRAL: { color: '#7a8498', tint: '#eceff4', border: '#d5dae2', label: 'Neutral' },
}

export const pct = (x) => (x == null ? '-' : `${Math.round(x * 100)}%`)

export const fmtTime = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return iso
  }
}

/**
 * Hook to animate numbers smoothly from 0 to target value on mount/change.
 * Respects prefers-reduced-motion accessibility preference.
 */
export function useAnimatedNumber(targetValue, duration = 1000) {
  const [current, setCurrent] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return targetValue
    }
    return 0
  })

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setCurrent(targetValue)
      return
    }

    if (targetValue == null || isNaN(targetValue)) {
      setCurrent(targetValue)
      return
    }

    let start = 0
    let startTime = null
    let animId = null

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic: 1 - Math.pow(1 - progress, 3)
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      const nextVal = start + (targetValue - start) * easeProgress
      setCurrent(nextVal)

      if (progress < 1) {
        animId = requestAnimationFrame(step)
      } else {
        setCurrent(targetValue)
      }
    }

    animId = requestAnimationFrame(step)
    return () => {
      if (animId) cancelAnimationFrame(animId)
    }
  }, [targetValue, duration])

  return current
}

export function Card({ children, className = '', highlight = false }) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-xs transition-shadow duration-200 hover:shadow-md ${
        highlight ? 'border-[#8e2cc9]/30 ring-1 ring-[#8e2cc9]/10' : ''
      } ${className}`}
    >
      {children}
    </section>
  )
}

export function SectionTitle({ icon: Icon, children, aside, subtitle }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
      <div>
        <h2 className="flex items-center gap-2.5 text-base font-bold tracking-tight text-ink sm:text-lg">
          {Icon && (
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f4e9fb] text-[#8e2cc9]">
              <Icon size={16} aria-hidden />
            </span>
          )}
          <span>{children}</span>
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}
      </div>
      {aside && <div className="text-xs">{aside}</div>}
    </div>
  )
}

export function Chip({ color, tint, border, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ${className}`}
      style={{
        color,
        backgroundColor: tint,
        border: border ? `1px solid ${border}` : undefined,
      }}
    >
      {children}
    </span>
  )
}

export function Meter({ value, color, label, height = 'h-2' }) {
  const numVal = Math.max(0, Math.min(1, Number(value) || 0))
  return (
    <div
      role="progressbar"
      aria-label={`${label}: ${Math.round(numVal * 100)}%`}
      aria-valuenow={Math.round(numVal * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`${height} w-full overflow-hidden rounded-full bg-[#ede9f2]`}
    >
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${Math.round(numVal * 100)}%`, backgroundColor: color }}
      />
    </div>
  )
}
