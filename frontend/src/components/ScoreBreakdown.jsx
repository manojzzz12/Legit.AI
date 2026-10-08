import { Calculator } from 'lucide-react'
import { Card, SectionTitle } from './ui.jsx'

export default function ScoreBreakdown({ overall }) {
  const rows = overall.components
  return (
    <Card>
      <SectionTitle icon={Calculator}>How the score was calculated</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-soft">
              <th className="py-2 font-semibold">Signal</th>
              <th className="py-2 text-right font-semibold">Value (0-1)</th>
              <th className="py-2 text-right font-semibold">Weight</th>
              <th className="py-2 text-right font-semibold">Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-line/60">
                <td className="py-2">{r.label}</td>
                {r.applicable ? (
                  <>
                    <td className="py-2 text-right tabular-nums">{r.value.toFixed(2)}</td>
                    <td className="py-2 text-right tabular-nums">{Math.round(r.weight * 100)}%</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{r.points.toFixed(1)}</td>
                  </>
                ) : (
                  <td colSpan={3} className="py-2 text-right text-ink-faint">Not applicable to this input; weight shared by the other signals</td>
                )}
              </tr>
            ))}
            <tr>
              <td className="py-2 font-bold" colSpan={3}>Trust score (importance-weighted across verified claims)</td>
              <td className="py-2 text-right text-base font-extrabold tabular-nums">{overall.trust_score}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-faint">Base weights: evidence support 35%, source reliability 25%, agreement 20%, manipulation 10%, provenance 10%. These are prototype heuristics.</p>
    </Card>
  )
}
