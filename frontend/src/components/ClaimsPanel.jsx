import { ListChecks } from 'lucide-react'
import { Card, Chip, Meter, pct, SectionTitle, STATUS_STYLE } from './ui.jsx'

export default function ClaimsPanel({ claims }) {
  return (
    <Card>
      <SectionTitle icon={ListChecks} aside={<span className="text-sm text-ink-soft">{claims.length} detected · {claims.filter((c) => c.verifiable).length} verified</span>}>
        Claims detected
      </SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        {claims.map((c, i) => {
          const s = STATUS_STYLE[c.status]
          return (
            <article key={c.id} className="rounded-md border border-line p-4" style={{ borderLeftWidth: 4, borderLeftColor: s.color }}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold">Claim #{i + 1}</span>
                <Chip color={s.color} tint={s.tint}>{c.status}</Chip>
                <span className="text-xs text-ink-faint">{c.type} · {c.importance} importance</span>
              </div>
              <p className="font-serif text-lg leading-snug">&ldquo;{c.claim}&rdquo;</p>
              {c.verifiable ? (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-ink-soft">
                    <span>Confidence in this claim</span><strong className="tabular-nums text-ink">{pct(c.confidence)}</strong>
                  </div>
                  <Meter value={c.confidence} color={s.color} label="Claim confidence" />
                  <p className="mt-2 text-sm text-ink-soft">{c.explanation}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">{c.explanation}</p>
              )}
            </article>
          )
        })}
      </div>
    </Card>
  )
}
