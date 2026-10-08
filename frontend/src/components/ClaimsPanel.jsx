import { useState } from 'react'
import { CheckCircle2, ChevronDown, HelpCircle, ListChecks, Search, ShieldAlert, Sparkles, XCircle } from 'lucide-react'
import { Card, Chip, Meter, pct, SectionTitle, STATUS_STYLE } from './ui.jsx'

export default function ClaimsPanel({ claims = [] }) {
  // Allow toggling expanded state for individual claim cards
  const [expanded, setExpanded] = useState(() => new Set(claims.map((c) => c.id)))

  const toggleClaim = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (expanded.size === claims.length) {
      setExpanded(new Set())
    } else {
      setExpanded(new Set(claims.map((c) => c.id)))
    }
  }

  const verifiableCount = claims.filter((c) => c.verifiable).length

  return (
    <Card>
      <SectionTitle
        icon={ListChecks}
        subtitle="Individual assertions extracted from content and independently evaluated"
        aside={
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-ink-soft">
              {claims.length} {claims.length === 1 ? 'Claim' : 'Claims'} ({verifiableCount} Verified)
            </span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-[11px] font-bold text-[#8e2cc9] hover:underline"
            >
              {expanded.size === claims.length ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        }
      >
        Extracted Claims &amp; Verification
      </SectionTitle>

      <div className="grid gap-4 md:grid-cols-2">
        {claims.map((c, i) => {
          const s = STATUS_STYLE[c.status] || STATUS_STYLE['NOT VERIFIED']
          const isOpen = expanded.has(c.id)
          const claimNum = String(i + 1).padStart(2, '0')

          // Status icon
          const StatusIcon =
            c.status === 'SUPPORTED'
              ? CheckCircle2
              : c.status === 'CONTRADICTED'
              ? XCircle
              : c.status === 'INCONCLUSIVE'
              ? HelpCircle
              : ShieldAlert

          const supportsCount = c.counts?.supports || 0
          const contradictsCount = c.counts?.contradicts || 0
          const neutralCount = c.counts?.neutral || 0
          const totalEvidence = supportsCount + contradictsCount + neutralCount

          return (
            <article
              key={c.id}
              className="group flex flex-col justify-between rounded-xl border border-line bg-white transition-all hover:border-[#dbcbe6] hover:shadow-sm"
              style={{ borderLeftWidth: 4, borderLeftColor: s.color }}
            >
              <div className="p-4 sm:p-5">
                {/* Header row: CLAIM 01 + Status Badge + Type */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black tracking-wide text-ink">
                      CLAIM {claimNum}
                    </span>
                    <span className="rounded bg-[#f5f3f8] px-2 py-0.5 font-mono text-[10px] font-semibold text-ink-faint uppercase">
                      {c.type} · {c.importance} imp
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-extrabold uppercase tracking-wide"
                      style={{ color: s.color, backgroundColor: s.tint }}
                    >
                      <StatusIcon size={12} strokeWidth={2.5} />
                      {s.label}
                    </span>
                  </div>
                </div>

                {/* Claim Statement */}
                <p className="mt-3 font-serif text-base sm:text-lg font-medium leading-snug text-ink">
                  &ldquo;{c.claim}&rdquo;
                </p>

                {/* Evidence count summary pill */}
                {totalEvidence > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                    <span>Evidence:</span>
                    {supportsCount > 0 && (
                      <span className="font-semibold text-[#0e8f7e]">
                        {supportsCount} Supporting
                      </span>
                    )}
                    {contradictsCount > 0 && (
                      <span className="font-semibold text-[#c0392b]">
                        {contradictsCount} Contradicting
                      </span>
                    )}
                    {neutralCount > 0 && (
                      <span className="text-ink-faint">
                        {neutralCount} Neutral
                      </span>
                    )}
                  </div>
                )}

                {/* Confidence Bar */}
                {c.verifiable && (
                  <div className="mt-4 rounded-lg bg-[#faf9fc] p-3 border border-line/50">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink-soft">Confidence in claim</span>
                      <strong className="font-mono tabular-nums text-ink">{pct(c.confidence)}</strong>
                    </div>
                    <Meter value={c.confidence} color={s.color} label={`Claim ${claimNum} confidence`} height="h-1.5" />
                  </div>
                )}

                {/* Expandable Investigation Details */}
                {isOpen && (
                  <div className="mt-3.5 space-y-2 border-t border-line/60 pt-3 text-xs">
                    <div className="text-ink-soft leading-relaxed">
                      <strong className="font-bold text-ink">Deduction: </strong>
                      {c.explanation}
                    </div>

                    {c.search_query && (
                      <div className="flex items-center gap-1.5 rounded-md bg-[#f6f4fa] px-2.5 py-1.5 font-mono text-[11px] text-ink-soft">
                        <Search size={12} className="text-[#8e2cc9] shrink-0" aria-hidden />
                        <span className="text-ink-faint">Query:</span>
                        <span className="truncate text-ink font-medium">{c.search_query}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card Footer: Accordion toggle */}
              <button
                type="button"
                onClick={() => toggleClaim(c.id)}
                className="flex w-full items-center justify-between border-t border-line/50 bg-[#faf8fc] px-4 py-2 text-[11px] font-semibold text-ink-soft transition-colors hover:bg-[#f3edf9] hover:text-[#8e2cc9]"
              >
                <span>{isOpen ? 'Hide rationale' : 'View forensic rationale'}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#8e2cc9]' : ''}`}
                />
              </button>
            </article>
          )
        })}
      </div>
    </Card>
  )
}
