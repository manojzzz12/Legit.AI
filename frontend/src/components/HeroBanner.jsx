import { ArrowRight, CheckCircle2, ChevronRight, FileSearch, Layers, Play, ShieldAlert, ShieldCheck, Sparkles, Zap } from 'lucide-react'

const PIPELINE_STEPS = [
  { step: '01', title: 'ANALYZE', desc: 'Multimodal & OCR' },
  { step: '02', title: 'INVESTIGATE', desc: 'Claim Extraction' },
  { step: '03', title: 'VERIFY', desc: 'Independent Sources' },
  { step: '04', title: 'ASSESS', desc: 'Deterministic Scoring' },
]

export default function HeroBanner({ demos = [], activeDemo, loading, onDemo }) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl border border-[#2d243b] bg-gradient-to-br from-[#12101e] via-[#171326] to-[#1c1228] p-6 text-white shadow-xl sm:p-7">
      {/* Subtle background ambient lights */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#8e2cc9]/15 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-24 -bottom-24 h-56 w-56 rounded-full bg-[#c42bc8]/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Brand & Philosophy */}
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#443058] bg-[#271b38]/70 px-3 py-1 text-[11px] font-bold tracking-wider text-[#d57cf7] uppercase">
            <Sparkles size={12} className="text-[#e293fa]" aria-hidden />
            <span>Digital Trust & Evidence Engine</span>
          </div>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
            LEGIT<span className="text-[#c42bc8]">.AI</span>
            <span className="mx-2.5 font-serif font-normal italic text-[#d4cae5] sm:text-2xl">
              — &ldquo;Beyond Fake or Real.&rdquo;
            </span>
          </h1>

          <p className="mt-2 text-sm text-[#b2a9c3] leading-relaxed">
            AI-powered evidence verification for images, claims, and digital content. We investigate primary sources, detect contradictions, and score trust deterministically before conclusions.
          </p>
        </div>

        {/* Pipeline Flow Indicator: ANALYZE -> INVESTIGATE -> VERIFY -> ASSESS */}
        <div className="flex-1 lg:max-w-md">
          <div className="rounded-xl border border-[#2e263d] bg-[#100d1c]/80 p-3.5 backdrop-blur-sm">
            <div className="mb-2.5 flex items-center justify-between text-[10px] font-mono font-bold tracking-wider text-[#9b8fad] uppercase">
              <span>EVIDENTIARY PIPELINE</span>
              <span className="text-[#c42bc8]">EVIDENCE BEFORE CONCLUSIONS</span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {PIPELINE_STEPS.map((p, idx) => (
                <div key={p.step} className="relative flex flex-col items-center text-center">
                  <div className="group flex w-full flex-col items-center rounded-lg border border-[#2b223a] bg-[#191426] px-1.5 py-2 transition-all hover:border-[#8e2cc9]/50 hover:bg-[#221835]">
                    <span className="font-mono text-[9px] font-bold text-[#8e7b9f]">{p.step}</span>
                    <span className="mt-0.5 text-[11px] font-extrabold tracking-wide text-white">
                      {p.title}
                    </span>
                    <span className="hidden sm:block mt-0.5 text-[9px] text-[#9388a6] leading-tight">
                      {p.desc}
                    </span>
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <ChevronRight
                      size={12}
                      className="hidden sm:block absolute -right-2 top-4 z-20 text-[#67597d]"
                      aria-hidden
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Sample Check Chips (for immediate demo test) */}
      {demos.length > 0 && (
        <div className="relative z-10 mt-5 border-t border-[#261f36] pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#a599be]">
              <Play size={11} fill="currentColor" className="text-[#c42bc8]" aria-hidden />
              QUICK TEST CASES:
            </span>

            {demos.map((d, i) => {
              const isActive = activeDemo === d.id && loading
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={loading}
                  onClick={() => onDemo(d.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    activeDemo === d.id
                      ? 'border-[#c42bc8] bg-[#3a1d48] text-white'
                      : 'border-[#362947] bg-[#1a1528] text-[#d6cde4] hover:border-[#8e2cc9] hover:bg-[#261c38] hover:text-white'
                  }`}
                  title={d.tagline}
                >
                  <span className="font-mono text-[10px] text-[#a491bc]">0{i + 1}</span>
                  <span>{d.label}</span>
                  <span className="text-[10px] text-[#9689ab] hidden sm:inline">({d.expected})</span>
                  <ArrowRight size={11} className="text-[#c42bc8]" aria-hidden />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
