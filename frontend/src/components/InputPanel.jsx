import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  AudioLines,
  Check,
  CheckCircle2,
  FileText,
  FileUp,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
  X,
} from 'lucide-react'

const FORMATS = [
  {
    key: 'text',
    label: 'Text & Claims',
    title: 'Verify Factual Claims',
    description: 'Paste a statement, news excerpt, or upload a document (TXT, PDF, DOCX). Legit.ai extracts discrete assertions and checks them against independent sources.',
    Icon: FileText,
    accept: '.txt,.md,.pdf,.docx',
    idleDropLabel: 'Drop document here or browse',
    formatsHint: 'TXT, MD, PDF, or DOCX (max 25 MB)',
    placeholder: 'Paste the statement, news article, or factual claim you want to verify…',
    buttonLabel: 'Analyze Evidence',
  },
  {
    key: 'image',
    label: 'Image & Photo',
    title: 'Inspect Image Evidence',
    description: 'Upload a photograph, graphic, or screenshot. Legit.ai extracts OCR text, analyzes visual consistency indicators, and searches for corroborating coverage.',
    Icon: ImageIcon,
    accept: 'image/*',
    idleDropLabel: 'Drop image here or browse',
    formatsHint: 'JPG, PNG, WEBP, or GIF (max 25 MB)',
    placeholder: 'What does this image claim to depict or prove? (Context helps verification)',
    buttonLabel: 'Analyze Image',
  },
  {
    key: 'video',
    label: 'Video Clip',
    title: 'Verify Video Claims',
    description: 'Upload a short video (up to 25 MB and 2 minutes). Legit.ai transcribes spoken audio, samples visual frames every second, and verifies key assertions.',
    Icon: Video,
    accept: 'video/*',
    idleDropLabel: 'Drop video here or browse',
    formatsHint: 'MP4, MOV, WEBM (up to 2 min, max 25 MB)',
    placeholder: 'Paste a transcript or describe what the video claims to show (optional)',
    buttonLabel: 'Analyze Video',
  },
  {
    key: 'audio',
    label: 'Audio Speech',
    title: 'Review Spoken Audio',
    description: 'Upload an audio recording to transcribe speech and verify the stated claims against independent records. You can also provide an existing transcript.',
    Icon: AudioLines,
    accept: 'audio/*',
    idleDropLabel: 'Drop audio here or browse',
    formatsHint: 'MP3, WAV, M4A, OGG (up to 2 min, max 25 MB)',
    placeholder: 'Paste a transcript or summarize the spoken claim (optional)',
    buttonLabel: 'Analyze Audio',
  },
]

export default function InputPanel({ pageType = 'text', loading, onAnalyze, onFormatChange }) {
  // Support either controlled external route or internal selection
  const activeKey = FORMATS.some((f) => f.key === pageType) ? pageType : 'text'
  const config = FORMATS.find((f) => f.key === activeKey) || FORMATS[0]

  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [refText, setRefText] = useState('')
  const [refFiles, setRefFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [justCompleted, setJustCompleted] = useState(false)

  const fileRef = useRef(null)
  const refRef = useRef(null)
  const prevLoadingRef = useRef(loading)

  // Track completion state for button feedback
  useEffect(() => {
    if (prevLoadingRef.current && !loading) {
      setJustCompleted(true)
      const timer = setTimeout(() => setJustCompleted(false), 2400)
      return () => clearTimeout(timer)
    }
    prevLoadingRef.current = loading
  }, [loading])

  // Generate thumbnail preview for uploaded images
  useEffect(() => {
    if (!file || activeKey !== 'image') {
      setPreviewUrl('')
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, activeKey])

  const canSubmit = activeKey === 'text' ? text.trim().length > 0 || !!file : !!file

  const acceptFile = (candidate) => {
    if (!candidate) return
    if (candidate.size > 25 * 1024 * 1024) {
      setFileError('File size exceeds the 25 MB limit.')
      return
    }
    if (activeKey === 'text' && !/\.(txt|md|pdf|docx)$/i.test(candidate.name)) {
      setFileError('Please choose a supported document (TXT, MD, PDF, or DOCX).')
      return
    }
    if (activeKey === 'image' && !candidate.type.startsWith('image/')) {
      setFileError('Please choose a valid image file (JPG, PNG, WEBP, or GIF).')
      return
    }
    if (activeKey === 'video' && !candidate.type.startsWith('video/')) {
      setFileError('Please choose a valid video file (MP4, WEBM, MOV).')
      return
    }
    if (activeKey === 'audio' && !candidate.type.startsWith('audio/')) {
      setFileError('Please choose a valid audio file (MP3, WAV, M4A).')
      return
    }
    setFileError('')
    setFile(candidate)
  }

  const handleClearFile = (e) => {
    e?.stopPropagation()
    setFile(null)
    setFileError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFormatClick = (key) => {
    if (onFormatChange) {
      onFormatChange(key)
    }
    setFileError('')
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <section className="workspace-card rounded-2xl border border-line bg-white p-6 shadow-sm transition-all sm:p-8">
      {/* Format Selector Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            INVESTIGATION MODE
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Investigation format">
          {FORMATS.map((f) => {
            const isSelected = f.key === activeKey
            const Icon = f.Icon
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleFormatClick(f.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#181326] text-white shadow-sm ring-1 ring-[#8e2cc9]/40'
                    : 'bg-[#f5f3f8] text-ink-soft hover:bg-[#ece8f3] hover:text-ink'
                }`}
              >
                <Icon size={14} className={isSelected ? 'text-[#d757f5]' : 'text-ink-faint'} aria-hidden />
                <span>{f.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Heading */}
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#ecd5f7] bg-gradient-to-br from-[#faf1ff] to-[#f2e4fb] text-[#8e2cc9] shadow-xs">
          <config.Icon size={22} aria-hidden />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-extrabold uppercase tracking-wider text-[#8e2cc9]">
              {config.label}
            </span>
            <span className="rounded-full bg-[#f4edf9] px-2 py-0.5 text-[10px] font-semibold text-[#7c29b0]">
              Multi-source Verification
            </span>
          </div>
          <h2 className="mt-1 text-xl font-black tracking-tight text-ink sm:text-2xl">
            {config.title}
          </h2>
          <p className="mt-1 text-xs text-ink-soft leading-relaxed sm:text-sm">
            {config.description}
          </p>
        </div>
      </div>

      {/* Primary Input Area */}
      <div className="mt-6 space-y-4">
        {activeKey === 'text' && (
          <div className="field-wrap">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-bold text-ink" htmlFor="claim-text">
                Statement, Claim, or Article Excerpt
              </label>
              {text.length > 0 && (
                <button
                  type="button"
                  onClick={() => setText('')}
                  className="text-[11px] font-medium text-ink-faint hover:text-[#c0392b] transition-colors"
                >
                  Clear text
                </button>
              )}
            </div>
            <textarea
              id="claim-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              maxLength={20000}
              placeholder={config.placeholder}
              className="content-input w-full rounded-xl border border-line bg-[#fdfcff] p-4 font-sans text-sm text-ink placeholder:text-ink-faint/60 transition-all focus:border-[#8e2cc9] focus:bg-white focus:shadow-sm focus:outline-none"
            />
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-faint">
              <span>Tip: Enter complete claims with specifics (dates, names, places) for best accuracy.</span>
              <span className="font-mono tabular-nums">{text.length.toLocaleString()} / 20,000</span>
            </div>
          </div>
        )}

        {/* Drag & Drop Zone */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-ink">
              {activeKey === 'text' ? 'Or upload a document to verify' : 'Evidence File'}
            </span>
            <span className="font-mono text-[10px] text-ink-faint">
              {config.formatsHint}
            </span>
          </div>

          <div
            className={`dropzone relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
              dragging
                ? 'border-[#9e31bf] bg-[#faf0fd] scale-[1.005]'
                : file
                ? 'border-solid border-[#ded8e6] bg-[#fbf9fd] text-left'
                : 'border-[#ded8e6] bg-[#faf8fc]/70 hover:border-[#9e31bf]/60 hover:bg-[#faf4fc]'
            }`}
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click()
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              acceptFile(e.dataTransfer.files?.[0])
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept={config.accept}
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />

            {file ? (
              /* State: Uploaded File with preview, metadata and remove action */
              <div
                className="flex w-full items-center justify-between gap-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Selected preview"
                      className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover shadow-xs"
                    />
                  ) : (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#f2e7fa] text-[#8e2cc9]">
                      <config.Icon size={24} aria-hidden />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-ink">
                        {file.name}
                      </p>
                      <span className="inline-flex items-center gap-1 rounded bg-[#e8f8f2] px-2 py-0.5 text-[10px] font-bold text-[#16866b]">
                        <Check size={11} strokeWidth={3} /> Ready
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {formatFileSize(file.size)} · Click &quot;Analyze&quot; to begin deep inspection
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearFile}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white border border-line text-ink-faint shadow-xs transition-colors hover:border-[#c0392b] hover:bg-[#fff2f0] hover:text-[#c0392b]"
                  title="Remove file"
                  aria-label="Remove selected file"
                >
                  <X size={16} />
                </button>
              </div>
            ) : dragging ? (
              /* State: Dragging active */
              <div className="py-2">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#9e31bf] text-white shadow-lg shadow-[#9e31bf]/20 animate-bounce">
                  <FileUp size={24} />
                </div>
                <strong className="mt-3 block text-sm font-bold text-[#8e2cc9]">
                  Release to investigate
                </strong>
                <span className="text-xs text-ink-soft">
                  File will be loaded into the evidence workspace
                </span>
              </div>
            ) : (
              /* State: Idle */
              <div className="py-2">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f4e9fb] text-[#8e2cc9] transition-transform group-hover:scale-105">
                  <Upload size={22} aria-hidden />
                </div>
                <strong className="mt-2.5 block text-sm font-bold text-ink">
                  {config.idleDropLabel}
                </strong>
                <p className="mt-1 text-xs text-ink-faint">
                  Supports {config.formatsHint}
                </p>
              </div>
            )}
          </div>

          {/* Friendly Validation Error Feedback */}
          {fileError && (
            <div
              role="alert"
              className="mt-2.5 flex items-center gap-2 rounded-xl border border-[#f5c6cb] bg-[#fbf2f2] px-3.5 py-2 text-xs text-[#a92b2b]"
            >
              <AlertCircle size={15} className="shrink-0" />
              <span>{fileError}</span>
            </div>
          )}
        </div>

        {/* Optional Context / Caption Field for Image, Video, Audio */}
        {activeKey !== 'text' && (
          <div className="field-wrap pt-1">
            <label className="mb-1.5 block text-xs font-bold text-ink" htmlFor="transcript">
              {activeKey === 'image' ? 'Claim or Caption Context (Optional)' : 'Transcript or Stated Claim (Optional)'}
            </label>
            <textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={3}
              placeholder={config.placeholder}
              className="content-input w-full rounded-xl border border-line bg-[#fdfcff] p-3 text-sm text-ink placeholder:text-ink-faint/60 transition-all focus:border-[#8e2cc9] focus:bg-white focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              {activeKey === 'image'
                ? 'Providing what the image claims to prove helps cross-reference specific event dates and locations.'
                : 'If provided, your transcript is evaluated alongside automatically sampled frames and audio.'}
            </p>
          </div>
        )}

        {/* Reference Evidence Accordion */}
        <details className="reference-panel rounded-xl border border-line bg-[#faf9fc] p-3.5 transition-all">
          <summary className="flex cursor-pointer items-center justify-between font-sans text-xs font-bold text-ink select-none">
            <div className="flex items-center gap-2">
              <Paperclip size={14} className="text-[#8e2cc9]" aria-hidden />
              <span>Add custom reference evidence</span>
              <span className="rounded-full bg-[#f0e6f7] px-2 py-0.5 text-[10px] font-bold text-[#8e2cc9]">
                Optional
              </span>
            </div>
          </summary>

          <div className="mt-3 space-y-3 pt-2 text-xs text-ink-soft">
            <p className="text-[11px] text-ink-faint">
              Provide specific official reports, press releases, or documents to directly compare against the claims in your input.
            </p>
            <textarea
              value={refText}
              onChange={(e) => setRefText(e.target.value)}
              rows={3}
              placeholder="Paste official notice, report excerpt, or baseline facts..."
              className="content-input w-full rounded-xl border border-line bg-white p-3 text-xs text-ink placeholder:text-ink-faint/60 focus:border-[#8e2cc9] focus:outline-none"
              aria-label="Reference evidence text"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#dbc6e6] bg-white px-3 py-1.5 text-xs font-bold text-[#8e2cc9] transition-all hover:bg-[#faf4fd]"
                onClick={() => refRef.current?.click()}
              >
                <Paperclip size={13} aria-hidden />
                <span>{refFiles.length ? `${refFiles.length} file(s) attached` : 'Attach reference documents'}</span>
              </button>
              <input
                ref={refRef}
                type="file"
                multiple
                accept=".txt,.md,.pdf,.docx"
                className="hidden"
                onChange={(e) => setRefFiles([...(e.target.files || [])])}
              />
              {refFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRefFiles([])}
                  className="text-[11px] text-ink-faint hover:text-[#c0392b]"
                >
                  Clear attachments
                </button>
              )}
            </div>

            {refFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {refFiles.map((f) => (
                  <span
                    key={`${f.name}-${f.size}`}
                    className="inline-flex items-center gap-1 rounded-md bg-[#eef8f5] px-2 py-1 text-[11px] font-medium text-[#16866b]"
                  >
                    <Check size={11} /> {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </details>

        {/* Action Row */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!canSubmit || loading}
              onClick={() =>
                onAnalyze(activeKey, {
                  text,
                  file,
                  transcript,
                  referenceText: refText,
                  referenceFiles: refFiles,
                })
              }
              className={`relative inline-flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-bold tracking-wide uppercase transition-all shadow-md cursor-pointer ${
                loading
                  ? 'bg-[#403352] text-white cursor-wait opacity-90'
                  : justCompleted
                  ? 'bg-[#0e8f7e] text-white shadow-[#0e8f7e]/20'
                  : !canSubmit
                  ? 'bg-[#d8d5df] text-[#8e8a9a] cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-[#8226d9] via-[#9e31bf] to-[#c42bc8] text-white shadow-[#8e2cc9]/25 hover:from-[#922ce8] hover:to-[#d230d7] hover:-translate-y-0.5 active:translate-y-0'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  <span>Investigating...</span>
                </>
              ) : justCompleted ? (
                <>
                  <CheckCircle2 size={16} aria-hidden />
                  <span>Evidence Analysis Complete</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} aria-hidden />
                  <span>{config.buttonLabel}</span>
                  <ArrowRight size={14} aria-hidden />
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-ink-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16866b]" />
              Client-isolated anonymous session
            </span>
            <span>·</span>
            <span>No data retained for model training</span>
          </div>
        </div>
      </div>
    </section>
  )
}
