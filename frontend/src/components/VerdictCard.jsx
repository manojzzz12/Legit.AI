import { Info, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react'
import { Card, DECISION_STYLE, Meter, pct, useAnimatedNumber } from './ui.jsx'

const BANDS = [
  { name: 'Very high risk', range: '0-19', min: 0, max: 19, color: '#8e1b1b' },
  { name: 'High risk', range: '20-39', min: 20, max: 39, color: '#c0392b' },
  { name: 'Inconclusive', range: '40-69', min: 40, max: 69, color: '#b87a00' },
  { name: 'Likely trusted', range: '70-89', min: 70, max: 89, color: '#3a9d6b' },
  { name: 'Trusted', range: '90-100', min: 90, max: 100, color: '#0e8f7e' },
]

export default function VerdictCard({ overall, headline }) {
  const style = DECISION_STYLE[overall.decision] || DECISION_STYLE['INCONCLUSIVE']
  const { Icon } = style
  const rawScore = Number(overall.trust_score) || 0
  const confidenceVal = Number(overall.confidence) || 0
  const riskVal = Math.max(0, 100 - Math.round(rawScore))

  // Animated values
  const animScore = useAnimatedNumber(rawScore, 1100)
  const animConfidence = useAnimatedNumber(confidenceVal * 100, 1100)
  const animRisk = useAnimatedNumber(riskVal, 1100)

  // Confidence color scale
  const confColor =
    confidenceVal >= 0.75 ? '#0e8f7e' : confidenceVal >= 0.5 ? '#b87a00' : '#c0392b'

  // Radial SVG math for 220 degree semi-arc
  const radius = 95
  const circumference = Math.PI * radius // semicircle perimeter
  const scorePercent = Math.min(100, Math.max(0, animScore)) / 100
  const strokeDashoffset = circumference * (1 - scorePercent)

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1.2fr]">
      {/* LEFT: Trust Score Hero Visualization */}
      <Card className="flex flex-col items-center justify-between p-6 sm:p-7">
        <div className="w-full text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="font-mono text-[11px] font-bold tracking-wider text-[#8e2cc9] uppercase">
              METRIC SUMMARY
            </span>
            <span className="rounded-full bg-[#f4e9fb] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#8e2cc9]">
              RULE-BASED
            </span>
          </div>
          <h2 className="mt-1 text-xl font-black tracking-tight text-ink">
            Trust Score
          </h2>
        </div>

        {/* Custom Radial Gauge */}
        <div
          className="relative my-4 flex flex-col items-center justify-center"
          role="img"
          aria-label={`Trust Score: ${Math.round(rawScore)} out of 100`}
        >
          <svg
            className="w-64 h-36 overflow-visible"
            viewBox="0 0 220 125"
          >
            {/* Background Arc */}
            <path
              d="M 20 110 A 90 90 0 0 1 200 110"
              fill="none"
              stroke="#ece9f1"
              strokeWidth="16"
              strokeLinecap="round"
            />
            {/* Active Colored Arc */}
            <path
              d="M 20 110 A 90 90 0 0 1 200 110"
              fill="none"
              stroke={style.color}
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-300 ease-out"
            />
          </svg>

          {/* Central Score readout */}
          <div className="pointer-events-none -mt-16 text-center">
            <div className="text-5xl font-black tracking-tight text-ink tabular-nums sm:text-6xl">
              {animScore.toFixed(1)}
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold uppercase tracking-wider text-ink-soft">
              TRUST SCORE
            </div>
          </div>
        </div>

        {/* Decision Bands Legend */}
        <div className="w-full border-t border-line/70 pt-4">
          <div className="mb-2 text-center text-[11px] font-medium text-ink-faint">
            Evidence-weighted decision bands (0–100):
          </div>
          <div className="grid grid-cols-5 gap-1 text-center">
            {BANDS.map((b) => {
              const isActive = rawScore >= b.min && rawScore <= b.max
              return (
                <div
                  key={b.name}
                  className={`rounded-lg py-1 px-0.5 transition-all ${
                    isActive
                      ? 'font-bold ring-2 shadow-xs'
                      : 'opacity-65'
                  }`}
                  style={{
                    backgroundColor: isActive ? `${b.color}15` : '#f8f7fa',
                    color: b.color,
                    boxShadow: isActive ? `0 0 0 1px ${b.color}` : 'none',
                  }}
                  title={`${b.name}: ${b.range}`}
                >
                  <div className="font-mono text-[9px] font-extrabold">{b.range}</div>
                  <div className="truncate text-[8px] sm:text-[9px]">{b.name}</div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-center text-[11px] text-ink-faint">
            Score is computed deterministically from corroborating evidence, domain authority, and signals.
          </p>
        </div>
      </Card>

      {/* RIGHT: Assessment / Decision Card */}
      <Card className="flex flex-col justify-between p-6 sm:p-7">
        <div>
          {/* Eyebrow */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-bold tracking-wider text-ink-faint uppercase">
              FINAL ASSESSMENT
            </span>
            <span className="rounded-full bg-[#f6f4f8] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-ink-soft">
              Case ID: {overall.raw_band ? overall.raw_band : 'VERIFIED'}
            </span>
          </div>

          {/* Verdict Badge */}
          <div className="mt-3">
            <div
              className="inline-flex items-center gap-3 rounded-2xl border-2 px-5 py-2.5 shadow-sm transition-all"
              style={{
                borderColor: style.border || style.color,
                color: style.color,
                backgroundColor: style.tint,
                boxShadow: `0 4px 18px ${style.glow || 'rgba(0,0,0,0.05)'}`,
              }}
            >
              <Icon size={28} strokeWidth={2.4} aria-hidden />
              <span className="text-2xl font-black tracking-wide sm:text-3xl">
                {overall.decision}
              </span>
            </div>
          </div>

          {/* Executive Headline */}
          <p className="mt-4 font-serif text-xl sm:text-2xl font-semibold leading-snug text-ink">
            {headline}
          </p>
        </div>

        {/* Metrics Row: Confidence & Risk */}
        <div className="mt-6 space-y-4 border-t border-line pt-5">
          <div className="grid grid-cols-2 gap-4">
            {/* Confidence */}
            <div className="rounded-xl border border-line bg-[#faf9fc] p-3.5">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-bold text-ink-soft">Confidence</span>
                <span className="font-mono text-base font-extrabold text-ink tabular-nums">
                  {Math.round(animConfidence)}%
                </span>
              </div>
              <div className="mt-2">
                <Meter value={confidenceVal} color={confColor} label="Confidence" height="h-2" />
              </div>
              <div className="mt-1 text-[10px] text-ink-faint">
                {overall.confidence_label || 'Evidence Consistency'}
              </div>
            </div>

            {/* Risk Index */}
            <div className="rounded-xl border border-line bg-[#faf9fc] p-3.5">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-bold text-ink-soft">Risk Level</span>
                <span className="font-mono text-base font-extrabold text-ink tabular-nums">
                  {Math.round(animRisk)}%
                </span>
              </div>
              <div className="mt-2">
                <Meter
                  value={riskVal / 100}
                  color={riskVal > 50 ? '#c0392b' : riskVal > 25 ? '#b87a00' : '#0e8f7e'}
                  label="Risk"
                  height="h-2"
                />
              </div>
              <div className="mt-1 text-[10px] text-ink-faint">
                {riskVal > 50 ? 'High Unverified Risk' : riskVal > 25 ? 'Moderate Uncertainty' : 'Minimal Contradiction'}
              </div>
            </div>
          </div>

          {/* Forced Inconclusive Alert Box */}
          {overall.forced_inconclusive && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-[#ecd399] bg-[#fffaf0] p-4 text-xs text-[#7c5500] shadow-xs"
            >
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#b87a00]" aria-hidden />
              <div>
                <strong className="text-sm font-bold block text-[#694700]">
                  Decision Overridden to INCONCLUSIVE
                </strong>
                <p className="mt-0.5 leading-relaxed text-[#7c5500]">
                  Mathematical score alone would read <strong>{overall.raw_band} ({overall.trust_score})</strong>, but conflicting independent sources prevented a confident verdict.
                </p>
                {overall.force_reasons?.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 space-y-0.5">
                    {overall.force_reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
