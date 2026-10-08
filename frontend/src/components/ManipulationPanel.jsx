import { CheckCircle2, Info, ScanSearch, ShieldAlert, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react'
import { Card, Meter, pct, SectionTitle } from './ui.jsx'

export default function ManipulationPanel({ manipulation = {} }) {
  const m = manipulation
  const isApplicable = m.applicable !== false && Array.isArray(m.indicators) && m.indicators.length > 0
  const riskVal = Number(m.risk) || 0
  const color = riskVal >= 0.6 ? '#c0392b' : riskVal >= 0.3 ? '#b87a00' : '#0e8f7e'

  return (
    <Card>
      <SectionTitle
        icon={ScanSearch}
        subtitle="Automated inspection of visual tampering, OCR discrepancies, and metadata"
        aside={
          isApplicable && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-bold uppercase"
              style={{
                color,
                backgroundColor: `${color}15`,
                border: `1px solid ${color}30`,
              }}
            >
              {m.risk_label || (riskVal >= 0.6 ? 'High Risk' : riskVal >= 0.3 ? 'Moderate' : 'Low Risk')}
            </span>
          )
        }
      >
        Manipulation &amp; Artifact Analysis
      </SectionTitle>

      {!isApplicable ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-[#faf9fc] p-4 text-xs text-ink-soft">
          <Info size={18} className="text-[#8e2cc9] shrink-0" aria-hidden />
          <span>
            {m.note || 'No media payload present. Manipulation analysis is bypassed for plain text and weight is automatically shared across empirical evidence signals.'}
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main Risk Gauge Bar */}
          <div className="rounded-xl border border-line bg-[#faf9fc] p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold text-ink-faint uppercase">
                  MANIPULATION RISK INDEX
                </span>
                <div className="text-sm font-bold text-ink">
                  {m.risk_label || 'Combined Risk'} Level
                </div>
              </div>
              <strong className="font-mono text-2xl font-black tabular-nums" style={{ color }}>
                {pct(m.risk)}
              </strong>
            </div>

            <div className="mt-2.5">
              <Meter value={m.risk} color={color} label="Manipulation Risk Level" height="h-2" />
            </div>
          </div>

          {/* Compact Indicator Cards */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {m.indicators.map((ind) => {
              const isFlagged = ind.detected && ind.severity >= 0.3

              return (
                <div
                  key={ind.name}
                  className={`rounded-xl border p-3.5 transition-all ${
                    isFlagged
                      ? 'border-[#f5b5ad] bg-[#fff8f7]'
                      : 'border-line/70 bg-white hover:border-[#dbcce6]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isFlagged ? (
                        <TriangleAlert size={16} className="text-[#c0392b] shrink-0" aria-hidden />
                      ) : (
                        <CheckCircle2 size={16} className="text-[#0e8f7e] shrink-0" aria-hidden />
                      )}
                      <strong className="text-xs font-bold text-ink">
                        {ind.name}
                      </strong>
                    </div>

                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isFlagged
                          ? 'bg-[#fbe6e3] text-[#c0392b]'
                          : 'bg-[#e2f4f1] text-[#0e8f7e]'
                      }`}
                    >
                      {isFlagged ? `Flagged (${ind.severity})` : 'Clear'}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-ink-soft leading-relaxed">
                    {ind.detail}
                  </p>

                  {ind.method && (
                    <div className="mt-2 font-mono text-[10px] text-ink-faint">
                      Method: {ind.method}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Disclaimer */}
          {m.disclaimer && (
            <p className="rounded-lg bg-[#faf8fc] border border-line/60 p-3 text-[11px] text-ink-soft leading-relaxed">
              <strong className="text-ink">Notice: </strong>
              {m.disclaimer}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
