import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Layers } from 'lucide-react'
import { Card, CLASS_STYLE, SectionTitle } from './ui.jsx'

export default function EvidenceSummary({ summary, claims }) {
  const data = claims.filter((c) => c.verifiable).map((c) => ({
    name: `Claim ${c.id.replace('c', '#')}`,
    Supports: c.counts.supports, Contradicts: c.counts.contradicts, Neutral: c.counts.neutral,
  }))
  const c = summary.counts
  return (
    <Card>
      <SectionTitle icon={Layers}>Evidence summary</SectionTitle>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        {['SUPPORTS', 'CONTRADICTS', 'NEUTRAL'].map((k) => (
          <div key={k} className="rounded-md py-2" style={{ backgroundColor: CLASS_STYLE[k].tint }}>
            <div className="text-2xl font-extrabold tabular-nums" style={{ color: CLASS_STYLE[k].color }}>{c[k]}</div>
            <div className="text-xs font-semibold text-ink-soft">{CLASS_STYLE[k].label}</div>
          </div>
        ))}
      </div>
      <div className="h-44" role="img" aria-label="Evidence items per claim, by classification">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10 }}>
            <CartesianGrid horizontal={false} stroke="#e7eaf0" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={70} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Supports" stackId="a" fill={CLASS_STYLE.SUPPORTS.color} isAnimationActive={false} />
            <Bar dataKey="Contradicts" stackId="a" fill={CLASS_STYLE.CONTRADICTS.color} isAnimationActive={false} />
            <Bar dataKey="Neutral" stackId="a" fill="#aab2c2" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-sm text-ink-soft">
        {summary.total} sources from {summary.distinct_domains} domains. Average reliability {summary.average_reliability ?? '-'} (prototype heuristic).
      </p>
    </Card>
  )
}
