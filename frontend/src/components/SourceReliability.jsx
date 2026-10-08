import { Award, ChevronDown, ExternalLink, Gauge, Globe, Shield, Sparkles } from 'lucide-react'
import { Card, CLASS_STYLE, Meter, SectionTitle } from './ui.jsx'

export default function SourceReliability({ claims = [], heuristics = {} }) {
  // Aggregate unique domains or sources
  const allSources = claims.flatMap((c) =>
    (c.evidence || []).map((e) => ({
      domain: e.domain,
      reliability: e.reliability || 0.5,
      classification: e.classification || 'NEUTRAL',
      sourceType: e.source_type_label || 'Web Domain',
      claimId: c.id,
      title: e.title,
    }))
  )

  // Deduplicate and rank by reliability descending
  const rankedSources = Array.from(
    allSources
      .reduce((map, item) => {
        if (!map.has(item.domain) || map.get(item.domain).reliability < item.reliability) {
          map.set(item.domain, item)
        }
        return map
      }, new Map())
      .values()
  ).sort((a, b) => b.reliability - a.reliability)

  const weights = heuristics.source_weights || {}

  return (
    <Card>
      <SectionTitle
        icon={Gauge}
        subtitle="Hierarchical weighting of domain authority, institutional backing, and provenance"
        aside={
          <span className="font-mono text-xs font-bold text-ink-soft">
            {rankedSources.length} Ranked Sources
          </span>
        }
      >
        Source Authority &amp; Reliability
      </SectionTitle>

      {/* Ranked Sources Visual Bars */}
      <div className="space-y-3">
        {rankedSources.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-faint italic">
            No external domains recorded.
          </p>
        ) : (
          rankedSources.map((s, idx) => {
            const cs = CLASS_STYLE[s.classification] || CLASS_STYLE.NEUTRAL
            const relPct = Math.round(s.reliability * 100)
            const relColor =
              relPct >= 80 ? '#0e8f7e' : relPct >= 65 ? '#3a9d6b' : relPct >= 50 ? '#b87a00' : '#c0392b'

            return (
              <div
                key={`${s.domain}-${idx}`}
                className="rounded-xl border border-line bg-[#faf9fc] p-3 transition-all hover:bg-white hover:shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-[#f0e7f7] font-mono text-[10px] font-black text-[#8e2cc9]">
                      #{idx + 1}
                    </span>
                    <strong className="text-sm font-bold text-ink">{s.domain}</strong>
                    <span className="rounded bg-white px-2 py-0.5 border border-line text-[10px] font-semibold text-ink-soft">
                      {s.sourceType}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold"
                      style={{ color: cs.color, backgroundColor: cs.tint }}
                    >
                      {cs.label}
                    </span>
                    <span className="font-mono text-xs font-extrabold tabular-nums text-ink">
                      {relPct}%
                    </span>
                  </div>
                </div>

                {/* Reliability progress bar */}
                <div className="mt-2.5">
                  <Meter value={s.reliability} color={relColor} label={`${s.domain} reliability`} height="h-2" />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Source Weighting Heuristic Details */}
      {heuristics.source_weights && (
        <details className="mt-4 rounded-xl border border-line bg-[#faf8fc] p-3 text-xs text-ink-soft">
          <summary className="cursor-pointer font-bold text-ink select-none hover:text-[#8e2cc9]">
            Why source reliability weights differ
          </summary>
          <p className="mt-2 text-ink-soft leading-relaxed">
            {heuristics.note ||
              'Legit.ai evaluates primary registries, peer-reviewed databases, and international news wire services with higher evidentiary confidence than unsourced blogs or social feeds.'}
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {Object.entries(weights).map(([k, w]) => (
              <div
                key={k}
                className="flex items-center justify-between rounded-lg border border-line/60 bg-white p-2"
              >
                <span className="font-medium text-ink-soft">{w.label}</span>
                <span className="font-mono text-xs font-bold text-[#8e2cc9]">
                  {(w.weight * 100).toFixed(0)}% weight
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </Card>
  )
}
