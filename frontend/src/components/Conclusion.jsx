import { AlertTriangle, BookOpenCheck, CheckCircle2, FileSignature, ShieldCheck, Sparkles } from 'lucide-react'
import { Card, SectionTitle } from './ui.jsx'

export default function Conclusion({ conclusion }) {
  if (!conclusion) return null

  return (
    <Card className="border-t-4 border-t-[#8e2cc9]">
      <SectionTitle
        icon={BookOpenCheck}
        subtitle="Final forensic synthesis detailing empirical findings, deductive reasoning, and investigative limits"
        aside={
          <span className="font-mono text-xs font-bold text-[#8e2cc9] uppercase tracking-wider">
            Official Report
          </span>
        }
      >
        Reasoned Investigative Report
      </SectionTitle>

      {/* Report Header / Headline */}
      <div className="rounded-xl border border-line/80 bg-gradient-to-r from-[#fbf9fe] to-[#f7f5fa] p-5 sm:p-6">
        <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-[#8e2cc9]">
          EXECUTIVE DEDUCTION
        </span>
        <h3 className="mt-1 font-serif text-xl sm:text-2xl font-bold leading-snug text-ink">
          {conclusion.headline}
        </h3>
      </div>

      {/* Structured Findings & Reasoning (Why) */}
      <div className="mt-6 space-y-4">
        <div>
          <h4 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-ink">
            <CheckCircle2 size={14} className="text-[#0e8f7e]" aria-hidden />
            <span>Evidentiary Reasoning &amp; Findings</span>
          </h4>
          <ul className="mt-2.5 space-y-2.5">
            {conclusion.reasoning?.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-line/60 bg-[#fdfcff] p-3 text-sm text-ink-soft leading-relaxed"
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-[#f3e9fb] font-mono text-[10px] font-bold text-[#8e2cc9]">
                  {i + 1}
                </span>
                <span className="text-ink">{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Caveats / Remaining Uncertainty */}
        {conclusion.caveats?.length > 0 && (
          <div className="mt-6 rounded-xl border border-[#ede7f5] bg-[#faf8fc] p-4 sm:p-5">
            <h4 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-[#795b10]">
              <AlertTriangle size={14} className="text-[#b87a00]" aria-hidden />
              <span>Limits of Evidence &amp; Remaining Uncertainty</span>
            </h4>
            <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-xs text-ink-soft leading-relaxed">
              {conclusion.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Investigator Stamp Footnote */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1.5">
          <FileSignature size={13} className="text-[#8e2cc9]" aria-hidden />
          <span>Legit.ai Automated Evidentiary Verification Protocol</span>
        </span>
        <span className="font-mono text-[10px]">
          Deterministic Rule Engine
        </span>
      </div>
    </Card>
  )
}
