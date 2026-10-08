import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Gauge } from 'lucide-react'
import { Card, CLASS_STYLE, SectionTitle } from './ui.jsx'

export default function SourceReliability({ claims, heuristics }) {
  const data = claims.flatMap((c) => c.evidence.map((e) => ({
    name: `${e.domain.length > 24 ? e.domain.slice(0, 23) + '…' : e.domain} (${c.id})`,
    reliability: e.reliability, classification: e.classification, type: e.source_type_label,
  })))
  return (
    <Card>
      <SectionTitle icon={Gauge}>Source reliability</SectionTitle>
      <div style={{ height: Math.max(180, data.length * 30 + 40) }} role="img" aria-label="Reliability weight of each source">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid horizontal={false} stroke="#e7eaf0" />
            <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} interval={0} />
            <Tooltip formatter={(v, _n, p) => [`${v} · ${p.payload.type}`, 'Reliability']} />
            <Bar dataKey="reliability" isAnimationActive={false}>
              {data.map((d, i) => <Cell key={i} fill={CLASS_STYLE[d.classification].color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mb-3 text-xs text-ink-faint">Bar colour shows how each source was classified: green supports, red contradicts, grey neutral.</p>

      <details className="rounded-md bg-paper p-3 text-sm">
        <summary className="cursor-pointer font-semibold">How reliability weights are set</summary>
        <p className="mt-2 text-ink-soft">{heuristics.note}</p>
        <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
          {Object.values(heuristics.source_weights).map((w) => (
            <li key={w.label} className="flex justify-between border-b border-line py-1"><span>{w.label}</span><strong className="tabular-nums">{w.weight.toFixed(2)}</strong></li>
          ))}
        </ul>
      </details>
    </Card>
  )
}
