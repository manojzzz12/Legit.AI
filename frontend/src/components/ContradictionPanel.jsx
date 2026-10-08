import { AlertOctagon, AlertTriangle, CheckCircle, ExternalLink, HelpCircle, Scale, ShieldCheck } from 'lucide-react'
import { Card, Chip, CLASS_STYLE, SectionTitle, STATUS_STYLE } from './ui.jsx'

export default function ContradictionPanel({ contradictions = [] }) {
  const hasConflicts = contradictions.length > 0

  return (
    <Card highlight={hasConflicts}>
      <SectionTitle
        icon={Scale}
        subtitle="Independent sources tested for mutual consistency and direct contradictions"
        aside={
          hasConflicts ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ebd399] bg-[#fffaf0] px-3 py-1 font-mono text-xs font-bold text-[#b87a00]">
              <AlertTriangle size={13} />
              {contradictions.length} Conflict{contradictions.length > 1 ? 's' : ''} Detected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f8f2] px-3 py-1 font-mono text-xs font-bold text-[#0e8f7e]">
              <CheckCircle size={13} />
              Consensus Verified
            </span>
          )
        }
      >
        Contradiction Analysis
      </SectionTitle>

      {!hasConflicts ? (
        <div className="flex items-center gap-3.5 rounded-xl border border-[#d6ecde] bg-[#f4fbf7] p-5 text-sm text-[#185e4d]">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d2f3e3] text-[#0e8f7e]">
            <ShieldCheck size={22} />
          </div>
          <div>
            <strong className="block font-bold text-[#0f4d3e]">
              No evidence conflicts detected
            </strong>
            <p className="mt-0.5 text-xs text-[#2a6857] leading-relaxed">
              All independent sources retrieved for this content either corroborate the extracted factual claims or remain neutral. No direct factual contradictions were encountered.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Prominent Investigator Warning Banner */}
          <div
            role="alert"
            className="rounded-2xl border-2 border-[#ebd399] bg-gradient-to-r from-[#fffaf0] via-[#fffbf2] to-[#fffdf7] p-5 text-sm shadow-xs"
          >
            <div className="flex items-start gap-3.5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fae8b4] text-[#b87a00]">
                <AlertOctagon size={24} />
              </div>
              <div>
                <span className="font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#b87a00]">
                  EVIDENTIARY DEADLOCK
                </span>
                <h3 className="text-base font-extrabold text-[#744e00] sm:text-lg">
                  Conflicting evidence detected
                </h3>
                <p className="mt-1 font-semibold text-[#8b5e00] leading-relaxed">
                  Legit.ai cannot establish a sufficiently reliable conclusion.
                </p>
                <p className="mt-1 text-xs text-[#805e19] leading-relaxed">
                  Independent sources report mutually opposing factual accounts. Rather than arbitrarily favoring one source over another, Legit.ai maps both sides transparently to prevent false certainty.
                </p>
              </div>
            </div>
          </div>

          {/* Each Contradictory Claim */}
          {contradictions.map((p) => {
            const st = STATUS_STYLE[p.conclusion] || STATUS_STYLE['INCONCLUSIVE']
            const supports = p.sides?.SUPPORTS || []
            const contradicts = p.sides?.CONTRADICTS || []
            const neutrals = p.sides?.NEUTRAL || []

            return (
              <div
                key={p.claim_id}
                className="overflow-hidden rounded-2xl border border-[#ebd399] bg-[#fdfcf9] shadow-xs"
              >
                {/* Claim Bar */}
                <div className="border-b border-[#ebd399]/70 bg-[#fef7e6] px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#8a5c00]">
                      CONTESTED ASSERTION
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#8a5c00]">
                        Verdict for this claim:
                      </span>
                      <Chip color={st.color} tint={st.tint} border={st.border}>
                        {p.conclusion}
                      </Chip>
                    </div>
                  </div>
                  <p className="mt-1.5 font-serif text-base sm:text-lg font-semibold text-ink">
                    &ldquo;{p.claim}&rdquo;
                  </p>
                </div>

                {/* Side-by-side Evidence Showdown */}
                <div className="grid gap-4 p-5 lg:grid-cols-2">
                  {/* Left Column: Supporting Evidence */}
                  <div className="flex flex-col gap-3 rounded-xl border border-[#c4e8db] bg-[#f7fcf9] p-4">
                    <div className="flex items-center justify-between border-b border-[#c4e8db] pb-2.5">
                      <span className="flex items-center gap-1.5 font-mono text-xs font-black tracking-wide text-[#0e8f7e] uppercase">
                        <CheckCircle size={14} />
                        SUPPORTING EVIDENCE ({supports.length})
                      </span>
                      <span className="rounded bg-[#d5f4e6] px-2 py-0.5 text-[10px] font-bold text-[#0e8f7e]">
                        Corroborating
                      </span>
                    </div>

                    {supports.length === 0 ? (
                      <p className="py-4 text-center text-xs text-ink-faint italic">
                        No supporting sources found for this assertion.
                      </p>
                    ) : (
                      supports.map((e, idx) => (
                        <div
                          key={e.id || idx}
                          className="rounded-lg border border-[#c9ecde] bg-white p-3 shadow-xs"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-ink truncate max-w-[200px]">
                              {e.domain}
                            </span>
                            <span className="font-mono text-[10px] text-[#0e8f7e] font-semibold">
                              Rel: {e.reliability?.toFixed(2)}
                            </span>
                          </div>
                          <p className="mt-1.5 font-semibold text-xs text-ink leading-snug">
                            {e.title}
                          </p>
                          <p className="mt-1 text-xs text-ink-soft leading-relaxed line-clamp-3">
                            &quot;{e.snippet}&quot;
                          </p>
                          {e.reasoning && (
                            <div className="mt-2 rounded bg-[#eef8f4] p-1.5 text-[11px] text-[#16866b]">
                              <strong>Rationale: </strong>{e.reasoning}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Right Column: Contradicting Evidence */}
                  <div className="flex flex-col gap-3 rounded-xl border border-[#f5b5ad] bg-[#fff8f7] p-4">
                    <div className="flex items-center justify-between border-b border-[#f5b5ad] pb-2.5">
                      <span className="flex items-center gap-1.5 font-mono text-xs font-black tracking-wide text-[#c0392b] uppercase">
                        <AlertOctagon size={14} />
                        CONTRADICTING EVIDENCE ({contradicts.length})
                      </span>
                      <span className="rounded bg-[#fbe6e3] px-2 py-0.5 text-[10px] font-bold text-[#c0392b]">
                        Opposing
                      </span>
                    </div>

                    {contradicts.length === 0 ? (
                      <p className="py-4 text-center text-xs text-ink-faint italic">
                        No contradicting sources found.
                      </p>
                    ) : (
                      contradicts.map((e, idx) => (
                        <div
                          key={e.id || idx}
                          className="rounded-lg border border-[#f7c0b8] bg-white p-3 shadow-xs"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-ink truncate max-w-[200px]">
                              {e.domain}
                            </span>
                            <span className="font-mono text-[10px] text-[#c0392b] font-semibold">
                              Rel: {e.reliability?.toFixed(2)}
                            </span>
                          </div>
                          <p className="mt-1.5 font-semibold text-xs text-ink leading-snug">
                            {e.title}
                          </p>
                          <p className="mt-1 text-xs text-ink-soft leading-relaxed line-clamp-3">
                            &quot;{e.snippet}&quot;
                          </p>
                          {e.reasoning && (
                            <div className="mt-2 rounded bg-[#fdf0ee] p-1.5 text-[11px] text-[#a82a1d]">
                              <strong>Rationale: </strong>{e.reasoning}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Neutral sources if present */}
                {neutrals.length > 0 && (
                  <div className="border-t border-[#ebd399]/40 bg-[#faf8fc] px-5 py-3">
                    <span className="font-mono text-[11px] font-bold text-ink-faint uppercase">
                      NEUTRAL OR INCONCLUSIVE SOURCES ({neutrals.length}):
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-ink-soft">
                      {neutrals.map((n, idx) => (
                        <span
                          key={n.id || idx}
                          className="rounded-md border border-line bg-white px-2 py-1"
                        >
                          <strong>{n.domain}:</strong> {n.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
