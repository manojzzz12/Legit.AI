import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckCircle2, Globe, HelpCircle, Layers, XCircle } from 'lucide-react'
import { Card, CLASS_STYLE, SectionTitle } from './ui.jsx'

export default function EvidenceSummary({ summary, claims = [] }) {
  if (!summary) return null

  const data = claims
    .filter((c) => c.verifiable)
    .map((c) => ({
      name: `Claim ${c.id.replace('c', '#')}`,
      Supports: c.counts?.supports || 0,
      Contradicts: c.counts?.contradicts || 0,
      Neutral: c.counts?.neutral || 0,
    }))

  const c = summary.counts || { SUPPORTS: 0, CONTRADICTS: 0, NEUTRAL: 0 }

  return (
    <Card>
      <SectionTitle
        icon={Layers}
        subtitle="Distribution of independent corroboration, contradictions, and domain breadth"
        aside={
          <span className="font-mono text-xs font-bold text-ink-soft">
            {summary.total} Sources across {summary.distinct_domains} Domains
          </span>
        }
      >
        Evidence Distribution Summary
      </SectionTitle>

      {/* Top 3 Metric Tiles */}
      <div className="mb-5 grid grid-cols-3 gap-3 text-center">
        <div
          className="rounded-xl border border-[#b4e6d6] p-3 shadow-xs"
          style={{ backgroundColor: CLASS_STYLE.SUPPORTS.tint }}
        >
          <div className="flex items-center justify-center gap-1 font-mono text-2xl font-black tabular-nums" style={{ color: CLASS_STYLE.SUPPORTS.color }}>
            <CheckCircle2 size={16} />
            <span>{c.SUPPORTS}</span>
          </div>
          <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-wide text-ink-soft">
            Supporting
          </div>
        </div>

        <div
          className="rounded-xl border border-[#f5b5ad] p-3 shadow-xs"
          style={{ backgroundColor: CLASS_STYLE.CONTRADICTS.tint }}
        >
          <div className="flex items-center justify-center gap-1 font-mono text-2xl font-black tabular-nums" style={{ color: CLASS_STYLE.CONTRADICTS.color }}>
            <XCircle size={16} />
            <span>{c.CONTRADICTS}</span>
          </div>
          <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-wide text-ink-soft">
            Contradicting
          </div>
        </div>

        <div
          className="rounded-xl border border-[#d5dae4] p-3 shadow-xs"
          style={{ backgroundColor: CLASS_STYLE.NEUTRAL.tint }}
        >
          <div className="flex items-center justify-center gap-1 font-mono text-2xl font-black tabular-nums text-[#525b6e]">
            <HelpCircle size={16} />
            <span>{c.NEUTRAL}</span>
          </div>
          <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-wide text-ink-soft">
            Neutral
          </div>
        </div>
      </div>

      {/* Recharts Stacked Horizontal Bar per Claim */}
      {data.length > 0 && (
        <div className="h-44 rounded-xl border border-line/60 bg-[#faf9fc] p-2" role="img" aria-label="Evidence items per claim, by classification">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 15, top: 10, bottom: 5 }}>
              <CartesianGrid horizontal={false} stroke="#e4e1ec" strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#736d85' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#453f57' }} width={70} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1c172b',
                  borderColor: '#392d4f',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '11px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: '4px' }} />
              <Bar dataKey="Supports" stackId="a" fill={CLASS_STYLE.SUPPORTS.color} isAnimationActive={false} />
              <Bar dataKey="Contradicts" stackId="a" fill={CLASS_STYLE.CONTRADICTS.color} isAnimationActive={false} />
              <Bar dataKey="Neutral" stackId="a" fill="#8892a4" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5 font-medium">
          <Globe size={13} className="text-[#8e2cc9]" />
          <span>Breadth: {summary.distinct_domains} independent domain registries</span>
        </span>
        <span className="font-mono text-[11px] font-bold text-ink">
          Avg Domain Reliability: {summary.average_reliability != null ? (summary.average_reliability * 100).toFixed(0) + '%' : 'N/A'}
        </span>
      </div>
    </Card>
  )
}
