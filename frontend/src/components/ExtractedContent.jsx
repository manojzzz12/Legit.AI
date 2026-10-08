import { Binary, FileText, Film, Hash, Image as ImageIcon, ScanText } from 'lucide-react'
import { Card, SectionTitle } from './ui.jsx'

export default function ExtractedContent({ input }) {
  if (!input) return null

  const blocks = []
  if (input.text) blocks.push(['Submitted Text', input.text])
  if (input.ocr_text) blocks.push(['Extracted OCR Text (from Image)', input.ocr_text])
  if (input.transcript) {
    blocks.push([
      input.type === 'video'
        ? 'Spoken Video Transcript'
        : 'Spoken Audio Transcript',
      input.transcript,
    ])
  }

  return (
    <Card>
      <SectionTitle
        icon={ScanText}
        subtitle="Raw forensic ingest including submitted content, OCR layer, and cryptographic hashes"
        aside={
          <span className="rounded-full bg-[#f4e9fb] px-3 py-1 font-mono text-xs font-bold text-[#8e2cc9] uppercase">
            {input.type} Ingest
          </span>
        }
      >
        Ingested Content &amp; Forensic Fingerprint
      </SectionTitle>

      <div className="mb-4">
        <span className="font-mono text-[10px] text-ink-faint uppercase font-bold">
          INTAKE TITLE
        </span>
        <h3 className="text-base font-bold text-ink sm:text-lg">{input.title}</h3>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Extracted text blocks */}
        <div className="space-y-4">
          {blocks.map(([label, body]) => (
            <figure key={label} className="space-y-1.5">
              <figcaption className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-ink-soft uppercase">
                <FileText size={12} className="text-[#8e2cc9]" />
                {label}
              </figcaption>
              <blockquote
                className={`rounded-xl border border-line/80 bg-[#faf9fc] p-4 font-serif text-sm sm:text-base leading-relaxed text-ink ${
                  input.type === 'video' ? 'max-h-72 overflow-y-auto' : ''
                }`}
              >
                &ldquo;{body}&rdquo;
              </blockquote>
            </figure>
          ))}

          {input.extraction_method && (
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-faint">
              <Binary size={12} />
              <span>Extraction Method: {input.extraction_method}</span>
            </div>
          )}
        </div>

        {/* Right Column: Visual Previews, Sampled Frames, Metadata & SHA256 */}
        <div className="space-y-4">
          {input.type === 'image' && (
            <div>
              <span className="mb-1.5 block font-mono text-[11px] font-bold text-ink-soft uppercase">
                Image Payload
              </span>
              {input.preview ? (
                <div className="overflow-hidden rounded-xl border border-line bg-[#fdfcff] p-2 shadow-xs">
                  <img
                    src={input.preview}
                    alt="Uploaded analysis target"
                    className="max-h-64 w-auto rounded-lg object-contain mx-auto"
                  />
                </div>
              ) : (
                <div className="grid h-36 place-items-center rounded-xl border border-dashed border-line bg-[#faf8fc] text-center text-xs text-ink-faint">
                  <div className="space-y-1">
                    <ImageIcon size={22} className="mx-auto text-ink-faint" />
                    <p className="font-medium text-ink-soft">Image Payload</p>
                    <p className="text-[10px]">(Processed live via OCR and multimodal scanner)</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Video Frames Sample */}
          {input.frames?.length > 0 && (
            <div className="rounded-xl border border-line bg-[#faf9fc] p-3.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1 font-mono text-xs font-bold text-ink">
                  <Film size={13} className="text-[#8e2cc9]" /> Sampled Video Frames
                </span>
                <span className="font-mono text-[10px] text-ink-faint">1 fps sampling</span>
              </div>
              <ul className="mt-2 space-y-2">
                {input.frames.map((f) => (
                  <li
                    key={f.timestamp}
                    className="flex items-center gap-3 rounded-lg border border-line/60 bg-white p-2 text-xs"
                  >
                    {f.thumb && (
                      <img
                        src={f.thumb}
                        alt=""
                        className="h-10 w-16 shrink-0 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <span className="font-mono text-[11px] font-bold text-[#8e2cc9]">
                        {f.timestamp}
                      </span>
                      <p className="text-ink-soft truncate text-xs">{f.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Metadata dl */}
          {Object.keys(input.metadata || {}).length > 0 && (
            <div className="rounded-xl border border-line bg-[#faf9fc] p-3.5">
              <span className="font-mono text-[11px] font-bold text-ink-faint uppercase block mb-2">
                EXIF &amp; Ingest Metadata
              </span>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                {Object.entries(input.metadata).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-soft font-medium">{k}:</dt>
                    <dd className="font-mono text-ink truncate">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* SHA-256 Fingerprint */}
          {input.sha256 && (
            <div className="flex items-center gap-2 rounded-lg bg-[#f4edf9] px-3 py-2 font-mono text-[11px] text-[#7826aa]">
              <Hash size={13} className="shrink-0" />
              <span className="font-bold text-ink-soft">SHA-256 Fingerprint:</span>
              <span className="truncate">{input.sha256}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
