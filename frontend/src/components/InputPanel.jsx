import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight, AudioLines, Check, FileText, Image as ImageIcon, Loader2,
  Paperclip, ShieldCheck, Upload, Video, X,
} from 'lucide-react'

const PAGE_CONFIG = {
  text: {
    label: 'Text check',
    title: 'Verify a claim',
    description: 'Paste a statement, article, or upload a document. Legit.Ai will extract factual claims and check them against available evidence.',
    Icon: FileText,
    accept: '.txt,.md,.pdf,.docx',
    uploadLabel: 'Drop a document here or browse',
    placeholder: 'Paste the text or claim you want to verify…',
    buttonLabel: 'Analyze text',
  },
  image: {
    label: 'Image check',
    title: 'Check an image',
    description: 'Upload a photo, screenshot, or graphic. Add context about what it claims to show for a more useful analysis.',
    Icon: ImageIcon,
    accept: 'image/*',
    uploadLabel: 'Drop an image here or browse',
    placeholder: 'What does this image claim to show? (optional)',
    buttonLabel: 'Analyze image',
  },
  video: {
    label: 'Video check',
    title: 'Analyze a video',
    description: 'Upload a short clip to transcribe its audio, read on-screen text, and inspect visual frames together. Add your own transcript as extra context.',
    Icon: Video,
    accept: 'video/*',
    uploadLabel: 'Drop a video here or browse',
    placeholder: 'Paste a transcript or describe the claim (optional)',
    buttonLabel: 'Analyze video',
  },
  audio: {
    label: 'Audio check',
    title: 'Review audio',
    description: 'Upload an audio clip and verify the claims in its transcript. You can provide a transcript manually if needed.',
    Icon: AudioLines,
    accept: 'audio/*',
    uploadLabel: 'Drop an audio file here or browse',
    placeholder: 'Paste a transcript or describe the claim (optional)',
    buttonLabel: 'Analyze audio',
  },
}

export default function InputPanel({ pageType = 'text', loading, onAnalyze }) {
  const config = PAGE_CONFIG[pageType] || PAGE_CONFIG.text
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [refText, setRefText] = useState('')
  const [refFiles, setRefFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const fileRef = useRef(null)
  const refRef = useRef(null)

  useEffect(() => {
    if (!file || pageType !== 'image') {
      setPreviewUrl('')
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, pageType])

  const canSubmit = pageType === 'text' ? text.trim().length > 0 || !!file : !!file
  const acceptFile = (candidate) => {
    if (!candidate) return
    if (candidate.size > 25 * 1024 * 1024) {
      setFileError('Files must be 25 MB or smaller.')
      return
    }
    if (pageType === 'text' && !/\.(txt|md|pdf|docx)$/i.test(candidate.name)) {
      setFileError('Please choose a TXT, MD, PDF, or DOCX document.')
      return
    }
    if (pageType === 'image' && !candidate.type.startsWith('image/')) {
      setFileError('Please choose an image file such as JPG, PNG, or WEBP.')
      return
    }
    if (pageType === 'video' && !candidate.type.startsWith('video/')) {
      setFileError('Please choose a video file.')
      return
    }
    if (pageType === 'audio' && !candidate.type.startsWith('audio/')) {
      setFileError('Please choose an audio file.')
      return
    }
    setFileError('')
    setFile(candidate)
  }

  return (
    <section className="workspace-card">
      <div className="workspace-heading">
        <span className="workspace-icon"><config.Icon size={21} aria-hidden /></span>
        <div>
          <span className="eyebrow">{config.label}</span>
          <h2>{config.title}</h2>
        </div>
      </div>
      <p className="workspace-description">{config.description}</p>

      {pageType === 'text' && (
        <div className="field-wrap">
          <label className="field-label" htmlFor="claim-text">Your content</label>
          <textarea
            id="claim-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            maxLength={20000}
            placeholder={config.placeholder}
            className="content-input"
          />
          <div className="field-meta"><span>Keep the original wording for the clearest result.</span><span>{text.length.toLocaleString()} / 20,000</span></div>
        </div>
      )}

      <div
        className={`dropzone ${dragging ? 'dropzone-active' : ''} ${file ? 'dropzone-filled' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); acceptFile(e.dataTransfer.files?.[0]) }}
      >
        <input ref={fileRef} type="file" accept={config.accept} className="hidden" onChange={(e) => acceptFile(e.target.files?.[0])} />
        {file ? (
          <div className="file-selected" onClick={(e) => e.stopPropagation()}>
            {previewUrl
              ? <img src={previewUrl} className="file-preview" alt="Selected image preview" />
              : <span className="file-icon"><config.Icon size={24} aria-hidden /></span>}
            <span className="file-details"><strong>{file.name}</strong><span>{(file.size / (1024 * 1024)).toFixed(2)} MB · Ready to analyze</span></span>
            <button type="button" className="icon-button" aria-label="Remove selected file" onClick={() => { setFile(null); setFileError(''); if (fileRef.current) fileRef.current.value = '' }}><X size={18} /></button>
          </div>
        ) : (
          <>
            <span className="upload-symbol"><Upload size={23} aria-hidden /></span>
            <strong>{config.uploadLabel}</strong>
            <span className="dropzone-help">{pageType === 'text' ? 'TXT, MD, PDF or DOCX' : pageType === 'image' ? 'JPG, PNG, WEBP and more' : 'Maximum file size: 25 MB'}</span>
          </>
        )}
      </div>
      {fileError && <p role="alert" className="file-error">{fileError}</p>}

      {pageType !== 'text' && (
        <div className="field-wrap transcript-field">
          <label className="field-label" htmlFor="transcript">{pageType === 'image' ? 'Context' : 'Transcript (optional)'}</label>
          <textarea
            id="transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={3}
            placeholder={config.placeholder}
            className="content-input"
          />
        </div>
      )}

      {(pageType === 'audio' || pageType === 'video') && (
        <p className="media-note">{pageType === 'video'
          ? 'Up to 25 MB and 2 minutes. Audio is transcribed and visual frames are scanned once per second; this is time-spaced sampling, not every encoded frame. Up to 6 factual claims are searched.'
          : 'Audio files are limited to 25 MB and the first 2 minutes.'}</p>
      )}

      <details className="reference-panel">
        <summary><Paperclip size={16} aria-hidden /> Add reference evidence <span>Optional</span></summary>
        <p>Include reference text or documents to compare against the claims in your content.</p>
        <textarea
          value={refText}
          onChange={(e) => setRefText(e.target.value)}
          rows={3}
          placeholder="Paste an official notice, report, or other reference text…"
          className="content-input reference-input"
          aria-label="Reference evidence text"
        />
        <button type="button" className="reference-file-button" onClick={() => refRef.current?.click()}>
          <Paperclip size={15} aria-hidden />
          {refFiles.length ? `${refFiles.length} file(s) attached` : 'Attach reference documents'}
        </button>
        <input ref={refRef} type="file" multiple accept=".txt,.md,.pdf,.docx" className="hidden" onChange={(e) => setRefFiles([...(e.target.files || [])])} />
        {refFiles.length > 0 && <div className="reference-files">{refFiles.map((ref) => <span key={`${ref.name}-${ref.size}`}><Check size={13} />{ref.name}</span>)}</div>}
      </details>

      <div className="submit-row">
        <button
          type="button"
          onClick={() => onAnalyze(pageType, { text, file, transcript, referenceText: refText, referenceFiles: refFiles })}
          disabled={!canSubmit || loading}
          className="primary-action"
        >
          {loading ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <ShieldCheck size={17} aria-hidden />}
          {loading ? 'Analyzing…' : config.buttonLabel}
          {!loading && <ArrowUpRight size={16} aria-hidden />}
        </button>
        <span className="privacy-note">Your uploads stay on your own backend.</span>
      </div>
    </section>
  )
}
