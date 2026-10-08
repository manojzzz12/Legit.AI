import { Film, ScanText } from 'lucide-react'
import { Card, SectionTitle } from './ui.jsx'

export default function ExtractedContent({ input }) {
  const blocks = []
  if (input.text) blocks.push(['Submitted text', input.text])
  if (input.ocr_text) blocks.push(['Text read from the image (OCR)', input.ocr_text])
  if (input.transcript) blocks.push([input.type === 'video' ? 'Video audio transcript (automatic + supplied)' : 'Spoken words (transcript)', input.transcript])

  return (
    <Card>
      <SectionTitle icon={ScanText} aside={<span className="rounded bg-paper px-2 py-0.5 text-xs font-semibold text-ink-soft">{input.type} input</span>}>
        What was analyzed
      </SectionTitle>
      <p className="mb-3 font-semibold">{input.title}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          {blocks.map(([label, body]) => (
            <figure key={label}>
              <figcaption className="mb-1 text-xs font-semibold text-ink-soft">{label}</figcaption>
              <blockquote className={`rounded-md border-l-4 border-info bg-paper p-3 font-serif text-base leading-relaxed ${input.type === 'video' ? 'video-extracted-text' : ''}`}>{body}</blockquote>
            </figure>
          ))}
          <p className="text-xs text-ink-faint">Extraction: {input.extraction_method}</p>
        </div>

        <div className="space-y-3">
          {input.type === 'image' && (input.preview
            ? <img src={input.preview} alt="Uploaded image" className="max-h-64 w-auto rounded-md border border-line" />
            : (
              <div className="grid h-40 place-items-center rounded-md border border-dashed border-line bg-paper text-center text-sm text-ink-faint">
                <div>Image preview<br /><span className="text-xs">(shown for uploaded images in live mode)</span></div>
              </div>
            ))}
          {input.frames?.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink-soft"><Film size={14} aria-hidden /> Sampled frames</div>
              <p className="mb-2 text-xs text-ink-faint">
                One frame per second was scanned. These are selected previews; on-screen text and visual checks cover all sampled frames.
              </p>
              <ul className="space-y-1.5">
                {input.frames.map((f) => (
                  <li key={f.timestamp} className="flex gap-3 rounded-md bg-paper p-2 text-sm">
                    {f.thumb && <img src={f.thumb} alt="" className="h-14 w-auto rounded" />}
                    <span className="font-mono text-xs text-info">{f.timestamp}</span>{f.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Object.keys(input.metadata || {}).length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {Object.entries(input.metadata).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-ink-soft">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
          )}
          <p className="font-mono text-[11px] text-ink-faint">Input fingerprint (sha256, first 16): {input.sha256}</p>
        </div>
      </div>
    </Card>
  )
}
