import { BookOpenCheck } from 'lucide-react'
import { Card, SectionTitle } from './ui.jsx'

export default function Conclusion({ conclusion }) {
  return (
    <Card>
      <SectionTitle icon={BookOpenCheck}>Reasoned conclusion</SectionTitle>
      <p className="font-serif text-2xl leading-snug">{conclusion.headline}</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 font-serif text-lg leading-relaxed">
        {conclusion.reasoning.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
      <div className="mt-5 rounded-md bg-paper p-4 text-sm text-ink-soft">
        <div className="mb-1 font-semibold text-ink">Limits of this result</div>
        <ul className="list-disc space-y-1 pl-5">{conclusion.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
      </div>
    </Card>
  )
}
