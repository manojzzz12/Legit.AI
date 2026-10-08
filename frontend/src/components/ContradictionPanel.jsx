import { Scale } from 'lucide-react'
import { Card, Chip, CLASS_STYLE, SectionTitle, STATUS_STYLE } from './ui.jsx'

const LETTERS = 'ABCDEFGHIJKLMNOP'

export default function ContradictionPanel({ contradictions }) {
  return (
    <Card>
      <SectionTitle icon={Scale}>Contradictions</SectionTitle>
      {contradictions.length === 0 ? (
        <p className="text-sm text-ink-soft">No sources disagreed on any verified claim.</p>
      ) : (
        <div className="space-y-5">
          {contradictions.map((p) => {
            let n = 0
            const st = STATUS_STYLE[p.conclusion]
            return (
              <div key={p.claim_id} className={`rounded-md border p-4 ${p.strongly_conflicting ? 'border-[#e5c97a] bg-[#fffaf0]' : 'border-line'}`}>
                <div className="mb-1 font-bold" style={{ color: p.strongly_conflicting ? '#8a5c00' : undefined }}>
                  {p.strongly_conflicting ? 'Conflicting evidence detected' : 'Mixed evidence, but one side is clearly weaker'}
                </div>
                <p className="mb-3 font-serif text-base">&ldquo;{p.claim}&rdquo;</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {['SUPPORTS', 'CONTRADICTS', 'NEUTRAL'].flatMap((k) =>
                    p.sides[k].map((e) => {
                      const letter = LETTERS[n++]
                      const cs = CLASS_STYLE[k]
                      return (
                        <div key={e.id} className="rounded-md border border-line bg-white p-3 text-sm" style={{ borderLeftWidth: 4, borderLeftColor: cs.color }}>
                          <div className="flex items-center justify-between gap-2">
                            <strong>Source {letter}</strong>
                            <Chip color={cs.color} tint={cs.tint}>{cs.label}</Chip>
                          </div>
                          <div className="mt-1 text-ink-soft">{e.domain} · reliability {e.reliability.toFixed(2)}</div>
                        </div>
                      )
                    }),
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
                  Conclusion: <Chip color={st.color} tint={st.tint}>{p.conclusion}</Chip>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
