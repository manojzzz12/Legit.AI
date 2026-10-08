import { Binary, Calculator, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react'
import { Card, SectionTitle } from './ui.jsx'

export default function ScoreBreakdown({ overall }) {
  if (!overall) return null
  const rows = overall.components || []

  return (
    <Card>
      <SectionTitle
        icon={Calculator}
        subtitle="Deterministic signal weighting model combining independent corroboration, provenance, and source reliability"
        aside={
          <span className="font-mono text-xs font-bold text-[#8e2cc9] uppercase tracking-wider">
            Deterministic Engine
          </span>
        }
      >
        Mathematical Score Derivation
      </SectionTitle>

      <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-xs">
        <table className="w-full min-w-[500px] text-xs">
          <thead>
            <tr className="border-b border-line bg-[#faf8fc] text-left font-mono font-bold text-ink-soft">
              <th className="py-3 px-4 uppercase tracking-wider">Investigative Signal</th>
              <th className="py-3 px-3 text-right uppercase tracking-wider">Normalized (0–1)</th>
              <th className="py-3 px-3 text-right uppercase tracking-wider">Weight %</th>
              <th className="py-3 px-4 text-right uppercase tracking-wider">Contribution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {rows.map((r) => (
              <tr key={r.key} className="hover:bg-[#faf9fc]/70 transition-colors">
                <td className="py-3 px-4 font-bold text-ink">
                  {r.label}
                </td>
                {r.applicable ? (
                  <>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-ink">
                      {r.value?.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-ink-soft">
                      {Math.round((r.weight || 0) * 100)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold tabular-nums text-[#8e2cc9]">
                      +{r.points?.toFixed(1)} pts
                    </td>
                  </>
                ) : (
                  <td colSpan={3} className="py-3 px-4 text-right font-mono text-[11px] text-ink-faint italic">
                    Not applicable to this input (weight dynamically normalized across active signals)
                  </td>
                )}
              </tr>
            ))}
            <tr className="bg-[#f7f3fa] font-bold text-ink">
              <td className="py-3.5 px-4 font-sans font-extrabold text-sm" colSpan={3}>
                Final Aggregate Trust Score (out of 100)
              </td>
              <td className="py-3.5 px-4 text-right font-mono text-lg font-black tabular-nums text-[#8e2cc9]">
                {overall.trust_score}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-faint">
        <span>Base heuristics: Evidence Support 35% · Source Reliability 25% · Cross-agreement 20% · Manipulation 10% · Provenance 10%</span>
        <span className="font-mono text-[#8e2cc9] font-bold">Transparent &amp; Auditable</span>
      </div>
    </Card>
  )
}
