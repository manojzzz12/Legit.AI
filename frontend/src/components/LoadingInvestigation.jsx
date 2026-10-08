import { useEffect, useState } from 'react'
import { Check, Loader2, Radio, Shield, Sparkles } from 'lucide-react'

const STAGES = [
  {
    id: 1,
    title: 'INGESTING CONTENT',
    detail: 'Parsing payload and computing SHA-256 fingerprint',
  },
  {
    id: 2,
    title: 'EXTRACTING CLAIMS',
    detail: 'Isolating verifiable assertions from background statements',
  },
  {
    id: 3,
    title: 'ANALYZING CONTENT',
    detail: 'Scanning OCR text, media artifacts, and metadata signals',
  },
  {
    id: 4,
    title: 'SEARCHING INDEPENDENT EVIDENCE',
    detail: 'Querying primary records, wire reports, and verified domains',
  },
  {
    id: 5,
    title: 'COMPARING SOURCES',
    detail: 'Evaluating corroboration and testing for contradictions',
  },
  {
    id: 6,
    title: 'ASSESSING RELIABILITY',
    detail: 'Weighting domain authority, source types, and provenance',
  },
  {
    id: 7,
    title: 'CALCULATING TRUST',
    detail: 'Executing deterministic multi-signal scoring rules',
  },
  {
    id: 8,
    title: 'FORMING CONCLUSION',
    detail: 'Synthesizing final findings, reasoning, and uncertainty caveats',
  },
]

export default function LoadingInvestigation({ kind = 'analysis' }) {
  const [currentStage, setCurrentStage] = useState(0)

  useEffect(() => {
    // Stage advance timer: advances stages smoothly during the request lifecycle
    const timings = [400, 900, 1500, 2300, 3100, 3900, 4700]
    const timeouts = timings.map((delay, index) =>
      setTimeout(() => {
        setCurrentStage(index + 1)
      }, delay)
    )

    return () => timeouts.forEach(clearTimeout)
  }, [])

  const progressPct = Math.min(94, Math.round(((currentStage + 1) / STAGES.length) * 100))

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative my-6 overflow-hidden rounded-2xl border border-[#3b2d4f] bg-[#120f1f] p-6 text-white shadow-2xl sm:p-8"
    >
      {/* Background ambient gradient glow */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#8e2cc9]/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#0e8f7e]/15 blur-3xl"
        aria-hidden="true"
      />

      {/* Header bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#2b213d] pb-5">
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-[#26173a] text-[#d456f3]">
            <Radio size={20} className="animate-pulse" aria-hidden />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c42bc8] opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#c42bc8]" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold tracking-widest text-[#d57cf7] uppercase">
                INVESTIGATION ENGINE
              </span>
              <span className="rounded-full bg-[#2a1e3b] px-2 py-0.5 font-mono text-[10px] text-[#b6a7cf]">
                LIVE EXECUTION
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-white sm:text-xl">
              Deep Multimodal Verification Active
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs text-[#a79bbd]">
          <span className="tabular-nums font-bold text-white">{progressPct}%</span>
          <span>COMPLETED</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 mt-5 h-1.5 w-full overflow-hidden rounded-full bg-[#201830]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#8e2cc9] via-[#c42bc8] to-[#0e8f7e] transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Investigation Pipeline Stages */}
      <div className="relative z-10 mt-6 grid gap-2.5 sm:grid-cols-2">
        {STAGES.map((stage, idx) => {
          const isDone = idx < currentStage
          const isActive = idx === currentStage
          const isPending = idx > currentStage

          return (
            <div
              key={stage.id}
              className={`flex items-start gap-3 rounded-xl border p-3 transition-all duration-300 ${
                isActive
                  ? 'border-[#9e34cb] bg-[#221635] shadow-lg shadow-[#8e2cc9]/10 ring-1 ring-[#9e34cb]/40'
                  : isDone
                  ? 'border-[#223531] bg-[#101c1a]/60 text-[#b5c7c3]'
                  : 'border-[#231b31]/60 bg-[#161224]/30 opacity-45'
              }`}
            >
              {/* Status indicator icon */}
              <div className="mt-0.5 shrink-0">
                {isDone ? (
                  <div className="grid h-5 w-5 place-items-center rounded-full bg-[#0e8f7e] text-white">
                    <Check size={12} strokeWidth={3} aria-hidden />
                  </div>
                ) : isActive ? (
                  <div className="grid h-5 w-5 place-items-center rounded-full bg-[#9e34cb] text-white">
                    <Loader2 size={12} className="animate-spin" aria-hidden />
                  </div>
                ) : (
                  <div className="grid h-5 w-5 place-items-center rounded-full border border-[#443859] text-[10px] font-mono text-[#8b7fa3]">
                    {stage.id}
                  </div>
                )}
              </div>

              {/* Stage content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-xs font-bold tracking-wide ${
                      isActive
                        ? 'text-[#f5adff]'
                        : isDone
                        ? 'text-[#69d3af]'
                        : 'text-[#8b7fa3]'
                    }`}
                  >
                    {stage.title}
                  </span>
                  {isActive && (
                    <span className="inline-flex items-center gap-1 rounded bg-[#3b1e4f] px-1.5 py-0.2 font-mono text-[9px] font-bold text-[#e89cfc] uppercase">
                      Active
                    </span>
                  )}
                  {isDone && (
                    <span className="inline-flex items-center gap-0.5 font-mono text-[9px] text-[#4ec49d]">
                      Done
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-[#9d92b3]">
                  {stage.detail}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer notice */}
      <div className="relative z-10 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#231b31] pt-4 text-xs text-[#8c80a3]">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-[#a84ce2]" aria-hidden />
          <span>Legit.ai evaluates evidence corroboration and source reliability before reaching conclusions.</span>
        </div>
        <span className="font-mono text-[11px] text-[#bfb5d4]">
          Deterministic evaluation pipeline
        </span>
      </div>
    </div>
  )
}
