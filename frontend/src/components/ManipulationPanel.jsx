import { CircleCheck, TriangleAlert, ScanSearch } from 'lucide-react'
import { Card, Meter, pct, SectionTitle } from './ui.jsx'

export default function ManipulationPanel({ manipulation }) {
  const m = manipulation
  const color = m.risk >= 0.6 ? '#c0392b' : m.risk >= 0.3 ? '#b87a00' : '#0e8f7e'
  return (
    <Card>
      <SectionTitle icon={ScanSearch}>Manipulation indicators</SectionTitle>
      {!m.applicable ? (
        <p className="text-sm text-ink-soft">{m.note}</p>
      ) : (
        <>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm text-ink-soft">Combined indicator level</span>
            <strong className="tabular-nums" style={{ color }}>{m.risk_label} · {pct(m.risk)}</strong>
          </div>
          <Meter value={m.risk} color={color} label="Manipulation indicator level" />
          <ul className="mt-4 space-y-3">
            {m.indicators.map((ind) => (
              <li key={ind.name} className="flex gap-2.5 text-sm">
                {ind.detected && ind.severity >= 0.3
                  ? <TriangleAlert size={17} className="mt-0.5 shrink-0 text-risk" aria-hidden />
                  : <CircleCheck size={17} className="mt-0.5 shrink-0 text-trust" aria-hidden />}
                <div>
                  <div className="font-semibold">{ind.name}{ind.detected && <span className="ml-2 text-xs font-medium text-ink-faint">severity {ind.severity}</span>}</div>
                  <div className="text-ink-soft">{ind.detail}</div>
                  <div className="text-xs text-ink-faint">{ind.method}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-md bg-paper p-3 text-sm font-medium">{m.disclaimer}</p>
        </>
      )}
    </Card>
  )
}
