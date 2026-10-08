import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Info } from 'lucide-react'
import { Card, DECISION_STYLE, Meter, pct } from './ui.jsx'

// Outer ring shows the decision bands, inner arc shows the score.
const BANDS = [
  { name: 'Very high risk', size: 20, color: '#8e1b1b' },
  { name: 'High risk', size: 20, color: '#c0392b' },
  { name: 'Inconclusive', size: 30, color: '#d9a21b' },
  { name: 'Likely trusted', size: 20, color: '#5faf86' },
  { name: 'Trusted', size: 10, color: '#0e8f7e' },
]

export default function VerdictCard({ overall, headline }) {
  const style = DECISION_STYLE[overall.decision]
  const { Icon } = style
  const score = overall.trust_score
  const confColor = overall.confidence >= 0.75 ? '#0e8f7e' : overall.confidence >= 0.5 ? '#b87a00' : '#c0392b'

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
      <Card>
        <h2 className="mb-1 text-lg font-bold">Trust score</h2>
        <div className="relative mx-auto h-[215px] max-w-[440px]" role="img" aria-label={`Trust score ${score} out of 100`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={BANDS} dataKey="size" startAngle={180} endAngle={0} cx="50%" cy="92%" innerRadius={158} outerRadius={170} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                {BANDS.map((b) => <Cell key={b.name} fill={b.color} fillOpacity={0.4} />)}
              </Pie>
              <Pie data={[{ v: score }, { v: 100 - score }]} dataKey="v" startAngle={180} endAngle={0} cx="50%" cy="92%" innerRadius={118} outerRadius={150} stroke="none" isAnimationActive={false}>
                <Cell fill={style.color} />
                <Cell fill="#e7eaf0" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-x-0 bottom-[8%] text-center">
            <div className="text-6xl font-extrabold leading-none tabular-nums">{Math.round(score)}</div>
            <div className="mt-1 text-sm text-ink-soft">out of 100</div>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-ink-faint">
          Outer ring: decision bands (0-19, 20-39, 40-69, 70-89, 90-100). Score is calculated by explicit rules, not by an AI model.
        </p>
      </Card>

      <Card className="flex flex-col justify-between gap-5">
        <div>
          <div className="text-sm font-semibold text-ink-soft">Decision</div>
          <div
            key={overall.decision}
            className="stamp mt-2 inline-flex items-center gap-3 rounded-md border-[3px] px-4 py-2"
            style={{ borderColor: style.color, color: style.color, backgroundColor: style.tint }}
          >
            <Icon size={30} aria-hidden />
            <span className="text-2xl font-extrabold tracking-wide sm:text-3xl">{overall.decision}</span>
          </div>
          <p className="mt-4 font-serif text-xl leading-snug">{headline}</p>
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-ink-soft">Confidence</span>
            <span className="text-2xl font-bold tabular-nums">{pct(overall.confidence)} <span className="text-sm font-medium text-ink-soft">{overall.confidence_label}</span></span>
          </div>
          <Meter value={overall.confidence} color={confColor} label="Confidence" />
          <p className="mt-2 text-xs text-ink-faint">Confidence measures how much, how reliable and how consistent the evidence is. It is separate from the trust score.</p>
        </div>

        {overall.forced_inconclusive && (
          <div className="flex gap-2 rounded-md border border-[#e5c97a] bg-[#fbf0d6] p-3 text-sm text-[#6b4a00]">
            <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
            <div>
              <strong>Score alone would read {overall.raw_band} ({overall.trust_score}).</strong> The decision is set to INCONCLUSIVE instead.
              <ul className="mt-1 list-disc pl-5">{overall.force_reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
