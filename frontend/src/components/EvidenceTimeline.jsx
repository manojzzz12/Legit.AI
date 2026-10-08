import { useState } from 'react'
import { AlertTriangle, Check, Clock, Radio, Waypoints } from 'lucide-react'
import { Card, fmtTime, SectionTitle } from './ui.jsx'

export default function EvidenceTimeline({ trail = [] }) {
  const [activeStep, setActiveStep] = useState(null)

  return (
    <Card>
      <SectionTitle
        icon={Waypoints}
        subtitle="Auditable execution log tracing every phase from payload ingestion to final score"
        aside={
          <span className="font-mono text-xs font-bold text-ink-soft">
            {trail.length} Trail Events
          </span>
        }
      >
        Forensic Audit Trail
      </SectionTitle>

      <ol className="relative pl-2 sm:pl-4 space-y-4">
        {trail.map((s, i) => {
          const isWarning = s.status === 'warning'
          const isSelected = activeStep === i
          const isLast = i === trail.length - 1

          return (
            <li
              key={`${s.step}-${i}`}
              onClick={() => setActiveStep(isSelected ? null : i)}
              className="relative flex cursor-pointer items-start gap-3.5 group"
            >
              {/* Connecting line */}
              {!isLast && (
                <div
                  className="absolute left-3.5 top-7 bottom-0 w-0.5 -ml-px bg-line group-hover:bg-[#8e2cc9]/40 transition-colors"
                  aria-hidden="true"
                />
              )}

              {/* Step indicator node */}
              <div
                className={`z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-white transition-all shadow-xs ${
                  isWarning
                    ? 'bg-[#b87a00]'
                    : isSelected
                    ? 'bg-[#8e2cc9] ring-4 ring-[#8e2cc9]/20'
                    : 'bg-[#0e8f7e] group-hover:scale-110'
                }`}
              >
                {isWarning ? (
                  <AlertTriangle size={13} aria-hidden />
                ) : (
                  <Check size={14} strokeWidth={2.5} aria-hidden />
                )}
              </div>

              {/* Step details card */}
              <div
                className={`flex-1 rounded-xl border p-3 transition-all ${
                  isSelected
                    ? 'border-[#9e31bf] bg-[#faf3fd] shadow-xs'
                    : 'border-line/70 bg-[#faf9fc] group-hover:border-[#dbcce6] group-hover:bg-white'
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-ink-faint">
                      STEP {String(i + 1).padStart(2, '0')}
                    </span>
                    <strong className="text-xs sm:text-sm font-bold text-ink">
                      {s.step}
                    </strong>
                  </div>

                  {s.timestamp && (
                    <div className="flex items-center gap-1 font-mono text-[10px] text-ink-faint">
                      <Clock size={10} aria-hidden />
                      <span>{fmtTime(s.timestamp)}</span>
                    </div>
                  )}
                </div>

                <p className="mt-1 text-xs text-ink-soft leading-relaxed">
                  {s.detail}
                </p>

                {isWarning && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded bg-[#fff8e6] px-2 py-0.5 text-[10px] font-semibold text-[#8a5c00]">
                    <AlertTriangle size={11} />
                    <span>Non-blocking limit encountered during this stage</span>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
