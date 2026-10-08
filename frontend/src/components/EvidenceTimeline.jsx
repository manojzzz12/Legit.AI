import { Check, TriangleAlert, Waypoints } from 'lucide-react'
import { Card, fmtTime, SectionTitle } from './ui.jsx'

export default function EvidenceTimeline({ trail }) {
  return (
    <Card>
      <SectionTitle icon={Waypoints}>Evidence trail</SectionTitle>
      <ol className="relative">
        {trail.map((s, i) => {
          const warn = s.status === 'warning'
          return (
            <li key={s.step} className="relative flex gap-3 pb-5 last:pb-0">
              {i < trail.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px bg-line" aria-hidden />}
              <span className={`z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-white ${warn ? 'bg-warn' : 'bg-trust'}`}>
                {warn ? <TriangleAlert size={14} aria-hidden /> : <Check size={15} aria-hidden />}
              </span>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-sm font-bold">{s.step}</span>
                  <time className="font-mono text-xs text-ink-faint">{fmtTime(s.timestamp)}</time>
                </div>
                <p className="text-sm text-ink-soft">{s.detail}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
