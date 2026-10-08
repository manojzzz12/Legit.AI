import { useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileSearch,
  Filter,
  Globe,
  HelpCircle,
  Link2,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { Card, Chip, CLASS_STYLE, fmtTime, Meter, SectionTitle } from './ui.jsx'

function EvidenceCard({ e }) {
  const cs = CLASS_STYLE[e.classification] || CLASS_STYLE.NEUTRAL
  const isSupports = e.classification === 'SUPPORTS'
  const isContradicts = e.classification === 'CONTRADICTS'

  return (
    <article
      className="group relative rounded-xl border border-line bg-white p-4 sm:p-5 transition-all hover:border-[#cfbedc] hover:shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: cs.color }}
    >
      {/* Top Header: Title, Stance Chip, and Domain */}
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 font-mono text-xs font-bold text-ink">
              <Globe size={13} className="text-[#8e2cc9]" aria-hidden />
              {e.domain}
            </span>
            <span className="rounded bg-[#f5f3f8] px-2 py-0.5 font-mono text-[10px] text-ink-faint">
              {e.source_type_label || e.content_type}
            </span>
            {e.retrieved_at && (
              <span className="font-mono text-[10px] text-ink-faint">
                {fmtTime(e.retrieved_at)}
              </span>
            )}
          </div>
          <h4 className="mt-1.5 font-sans text-sm sm:text-base font-bold leading-snug text-ink">
            {e.title}
          </h4>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-extrabold uppercase tracking-wide"
            style={{ color: cs.color, backgroundColor: cs.tint }}
          >
            {isSupports ? (
              <CheckCircle2 size={12} strokeWidth={2.5} />
            ) : isContradicts ? (
              <XCircle size={12} strokeWidth={2.5} />
            ) : (
              <HelpCircle size={12} strokeWidth={2.5} />
            )}
            {cs.label}
          </span>
        </div>
      </div>

      {/* Reliability & Domain Authority Metric */}
      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg bg-[#faf9fc] p-2.5 border border-line/60">
        <div className="flex items-center gap-2 min-w-[140px]">
          <span className="text-[11px] font-semibold text-ink-soft">Reliability:</span>
          <span className="font-mono text-xs font-bold text-ink tabular-nums">
            {(e.reliability * 100).toFixed(0)}%
          </span>
          <div className="w-16">
            <Meter
              value={e.reliability}
              color={e.reliability >= 0.75 ? '#0e8f7e' : e.reliability >= 0.5 ? '#b87a00' : '#c0392b'}
              label="Reliability"
              height="h-1.5"
            />
          </div>
        </div>

        {e.url && !e.simulated ? (
          <a
            href={e.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#8e2cc9] hover:underline"
          >
            <span>Visit source</span>
            <ExternalLink size={12} />
          </a>
        ) : e.simulated ? (
          <span className="font-mono text-[10px] text-ink-faint">
            (Simulated reference fixture)
          </span>
        ) : null}
      </div>

      {/* Snippet Block */}
      <blockquote className="mt-3 rounded-lg border-l-2 border-line bg-[#fbfafc] p-3 font-serif text-sm text-ink-soft italic leading-relaxed">
        &ldquo;{e.snippet}&rdquo;
      </blockquote>

      {/* Reason / Deductive Role */}
      {e.reasoning && (
        <div className="mt-2.5 text-xs text-ink-soft leading-relaxed">
          <strong className="font-bold text-ink">Investigative role: </strong>
          {e.reasoning}
        </div>
      )}

      {/* Provenance Record Accordion */}
      <details className="mt-3 border-t border-line/60 pt-2 text-xs text-ink-soft">
        <summary className="cursor-pointer font-bold text-[11px] text-[#8e2cc9] hover:underline">
          View provenance record
        </summary>
        <div className="mt-2 rounded-lg bg-[#f9f8fb] p-3 font-mono text-[11px] space-y-1">
          <div className="flex gap-2">
            <span className="text-ink-faint shrink-0 w-24">URL:</span>
            <span className="break-all text-ink">{e.url || 'Internal / User-supplied'}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-ink-faint shrink-0 w-24">Content type:</span>
            <span className="text-ink">{e.content_type || 'unspecified'}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-ink-faint shrink-0 w-24">Method:</span>
            <span className="text-ink">{e.processing_method || 'live search'}</span>
          </div>
          {e.provenance_completeness != null && (
            <div className="flex gap-2">
              <span className="text-ink-faint shrink-0 w-24">Completeness:</span>
              <span className="text-ink">{Math.round(e.provenance_completeness * 100)}% metadata verified</span>
            </div>
          )}
        </div>
      </details>
    </article>
  )
}

export default function EvidenceList({ claims = [] }) {
  const verified = claims.filter((c) => c.verifiable)
  const [openClaims, setOpenClaims] = useState(() => new Set(verified.map((c) => c.id)))
  const [filterStance, setFilterStance] = useState('ALL')

  const toggleClaim = (id) =>
    setOpenClaims((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Count total evidence across verified claims
  const allEvidence = verified.flatMap((c) => c.evidence || [])
  const supportsTotal = allEvidence.filter((e) => e.classification === 'SUPPORTS').length
  const contradictsTotal = allEvidence.filter((e) => e.classification === 'CONTRADICTS').length
  const neutralTotal = allEvidence.filter((e) => e.classification === 'NEUTRAL').length

  return (
    <Card>
      <SectionTitle
        icon={FileSearch}
        subtitle="Primary documents, media outlets, and independent sources retrieved for verification"
        aside={
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterStance('ALL')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                filterStance === 'ALL'
                  ? 'bg-[#1b1528] text-white'
                  : 'bg-[#f4f2f7] text-ink-soft hover:bg-[#eae6f0]'
              }`}
            >
              All ({allEvidence.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStance('SUPPORTS')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                filterStance === 'SUPPORTS'
                  ? 'bg-[#0e8f7e] text-white'
                  : 'bg-[#e2f4f1] text-[#0e8f7e] hover:bg-[#d0efe8]'
              }`}
            >
              Supports ({supportsTotal})
            </button>
            <button
              type="button"
              onClick={() => setFilterStance('CONTRADICTS')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                filterStance === 'CONTRADICTS'
                  ? 'bg-[#c0392b] text-white'
                  : 'bg-[#fbe6e3] text-[#c0392b] hover:bg-[#f8d0cc]'
              }`}
            >
              Contradicts ({contradictsTotal})
            </button>
            <button
              type="button"
              onClick={() => setFilterStance('NEUTRAL')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                filterStance === 'NEUTRAL'
                  ? 'bg-[#5e6678] text-white'
                  : 'bg-[#eceff4] text-[#5e6678] hover:bg-[#e0e4ec]'
              }`}
            >
              Neutral ({neutralTotal})
            </button>
          </div>
        }
      >
        Evidence Investigation Workspace
      </SectionTitle>

      <div className="space-y-4">
        {verified.map((c, i) => {
          const rawEv = c.evidence || []
          const filteredEv =
            filterStance === 'ALL'
              ? rawEv
              : rawEv.filter((e) => e.classification === filterStance)

          const isClaimOpen = openClaims.has(c.id)

          return (
            <div
              key={c.id}
              className="overflow-hidden rounded-xl border border-line bg-[#faf9fc]"
            >
              {/* Accordion Header */}
              <button
                type="button"
                onClick={() => toggleClaim(c.id)}
                aria-expanded={isClaimOpen}
                className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-[#f4eff8] cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-[#8e2cc9]">
                      CLAIM {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-xs text-ink-faint">·</span>
                    <span className="text-xs font-medium text-ink-soft">
                      {rawEv.length} sources found
                    </span>
                  </div>
                  <div className="mt-1 font-serif text-base sm:text-lg font-medium text-ink leading-snug">
                    &ldquo;{c.claim}&rdquo;
                  </div>
                </div>

                <ChevronDown
                  size={18}
                  className={`shrink-0 text-ink-faint transition-transform duration-200 ${
                    isClaimOpen ? 'rotate-180 text-[#8e2cc9]' : ''
                  }`}
                  aria-hidden
                />
              </button>

              {/* Evidence cards body */}
              {isClaimOpen && (
                <div className="space-y-3 border-t border-line bg-white p-4 sm:p-5">
                  {filteredEv.length === 0 ? (
                    <p className="py-4 text-center text-xs text-ink-faint italic">
                      {filterStance === 'ALL'
                        ? 'No independent evidence was located for this specific claim.'
                        : `No evidence classified as "${filterStance.toLowerCase()}" for this claim.`}
                    </p>
                  ) : (
                    filteredEv.map((e) => <EvidenceCard key={e.id} e={e} />)
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
