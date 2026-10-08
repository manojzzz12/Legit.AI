import { useState } from 'react'
import { ChevronDown, FileSearch, Link2 } from 'lucide-react'
import { Card, Chip, CLASS_STYLE, fmtTime, SectionTitle } from './ui.jsx'

function EvidenceCard({ e }) {
  const cs = CLASS_STYLE[e.classification]
  return (
    <article className="rounded-md border border-line p-4" style={{ borderLeftWidth: 4, borderLeftColor: cs.color }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="max-w-xl font-bold leading-snug">{e.title}</h4>
        <Chip color={cs.color} tint={cs.tint}>{cs.label}</Chip>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
        <span className="font-semibold text-ink">{e.domain}</span>
        {e.url && !e.simulated && <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-info underline">Open source</a>}
        <span>{e.source_type_label}</span>
        <span>Reliability <strong className="text-ink tabular-nums">{e.reliability.toFixed(2)}</strong></span>
        <span>Retrieved {fmtTime(e.retrieved_at)}</span>
      </div>
      <p className="mt-2 text-sm">{e.snippet}</p>
      <p className="mt-2 rounded bg-paper p-2 text-sm"><span className="font-semibold">Reason: </span>{e.reasoning}</p>
      <details className="mt-2 text-xs text-ink-soft">
        <summary className="cursor-pointer font-semibold">Provenance record</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt>URL</dt><dd className="break-all font-mono">{e.url || 'Not available (supplied document, screenshot or unsourced item)'}</dd>
          <dt>Content type</dt><dd>{e.content_type}</dd>
          <dt>Processing</dt><dd>{e.processing_method}</dd>
          <dt>Completeness</dt><dd>{Math.round(e.provenance_completeness * 100)}% of provenance fields present</dd>
        </dl>
        {e.simulated && <p className="mt-2 flex items-center gap-1 font-semibold text-warn"><Link2 size={13} aria-hidden /> Simulated source. The URL is a placeholder and is intentionally not clickable.</p>}
      </details>
    </article>
  )
}

export default function EvidenceList({ claims }) {
  const verified = claims.filter((c) => c.verifiable)
  const [open, setOpen] = useState(() => new Set(verified.slice(0, 1).map((c) => c.id)))
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <Card>
      <SectionTitle icon={FileSearch}>Evidence by claim</SectionTitle>
      <div className="space-y-3">
        {verified.map((c) => (
          <div key={c.id} className="rounded-md border border-line">
            <button onClick={() => toggle(c.id)} aria-expanded={open.has(c.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
              <div>
                <div className="text-sm font-semibold text-ink-soft">Claim {c.id.replace('c', '#')} · {c.evidence.length} sources · query: <span className="font-mono text-xs">{c.search_query}</span></div>
                <div className="font-serif text-lg leading-snug">{c.claim}</div>
              </div>
              <ChevronDown size={20} className={`shrink-0 transition-transform ${open.has(c.id) ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {open.has(c.id) && (
              <div className="space-y-3 border-t border-line p-4">
                {c.evidence.length === 0 ? <p className="text-sm text-ink-soft">No independent evidence was found.</p> : c.evidence.map((e) => <EvidenceCard key={e.id} e={e} />)}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
