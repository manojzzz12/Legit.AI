import { useState } from 'react'
import {
  AudioLines,
  Clock,
  Database,
  FileText,
  History,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Video,
  X,
  Zap,
} from 'lucide-react'
import { Chip, DECISION_STYLE } from './ui.jsx'

const TYPE_ICONS = {
  text: FileText,
  document: FileText,
  image: ImageIcon,
  audio: AudioLines,
  video: Video,
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'image', label: 'Image' },
  { key: 'text', label: 'Text' },
  { key: 'audio', label: 'Audio' },
  { key: 'video', label: 'Video' },
]

function formatTimestamp(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    const now = new Date()
    const diffMs = now - d
    const diffMin = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMin / 60)

    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return isoStr
  }
}

export default function HistoryPanel({
  isOpen,
  onClose,
  history = [],
  selectedId,
  onSelect,
  onDelete,
  onClearAll,
  loading = false,
  filter = 'all',
  onFilterChange,
  error = null,
}) {
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)

  if (!isOpen) return null

  const handleCardClick = (id) => {
    if (deleteConfirmId) {
      setDeleteConfirmId(null)
      return
    }
    onSelect(id)
  }

  const handleDeleteClick = (e, id) => {
    e.stopPropagation()
    if (deleteConfirmId === id) {
      onDelete(id)
      setDeleteConfirmId(null)
    } else {
      setDeleteConfirmId(id)
    }
  }

  const handleClearAllClick = () => {
    if (confirmClearAll) {
      onClearAll()
      setConfirmClearAll(false)
    } else {
      setConfirmClearAll(true)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col bg-white shadow-2xl transition-transform"
        role="dialog"
        aria-modal="true"
        aria-label="Analysis History"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#f2e7fa] text-[#8e2cc9]">
              <History size={18} aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">Analysis History</h2>
              <p className="text-xs text-ink-faint">Saved runs & instant cache</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllClick}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                  confirmClearAll
                    ? 'bg-[#c0392b] text-white hover:bg-[#a92e22]'
                    : 'text-ink-faint hover:bg-[#f6dcdc] hover:text-[#8e1b1b]'
                }`}
                title="Clear all saved history"
              >
                {confirmClearAll ? 'Confirm Clear All?' : 'Clear all'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-paper hover:text-ink"
              aria-label="Close history panel"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 border-b border-line bg-[#faf9fc] px-5 py-2.5">
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setDeleteConfirmId(null)
                  onFilterChange(f.key)
                }}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#2a1e36] text-white'
                    : 'bg-white text-ink-soft hover:bg-[#ece8f2] hover:text-ink border border-line'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="rounded-lg border border-[#f5c6cb] bg-[#f8d7da] p-3 text-xs text-[#721c24]">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-ink-faint">
              <Loader2 size={24} className="animate-spin text-[#8e2cc9]" />
              <span className="text-xs">Loading history...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-3 px-6 text-center text-ink-faint">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-paper text-ink-faint">
                <Database size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-soft">No analyses found</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {filter === 'all'
                    ? 'Run a claim check in Text or Images to see results saved here automatically.'
                    : `No ${filter} analyses found. Try switching filters or running a new check.`}
                </p>
              </div>
            </div>
          ) : (
            history.map((item) => {
              const style = DECISION_STYLE[item.verdict] || DECISION_STYLE['INCONCLUSIVE']
              const Icon = TYPE_ICONS[item.analysis_type] || FileText
              const isSelected = selectedId === item.id
              const isConfirmingDelete = deleteConfirmId === item.id

              return (
                <div
                  key={item.id}
                  onClick={() => handleCardClick(item.id)}
                  className={`group relative flex cursor-pointer flex-col gap-2.5 rounded-xl border p-3.5 transition-all ${
                    isSelected
                      ? 'border-[#9e31bf] bg-[#faf3fd] ring-2 ring-[#9e31bf]/20 shadow-sm'
                      : 'border-line bg-white hover:border-[#d5b4e6] hover:bg-[#fcfaff] hover:shadow-xs'
                  }`}
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-[#f4edf9] px-2 py-0.5 text-[11px] font-bold text-[#8e2cc9] capitalize">
                        <Icon size={12} aria-hidden />
                        {item.analysis_type}
                      </span>
                      {item.from_cache && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-[#e8f8f2] px-1.5 py-0.5 text-[10px] font-bold text-[#16866b]" title="Cached result">
                          <Zap size={10} aria-hidden />
                          Cached
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Chip color={style.color} tint={style.tint} className="text-[11px]">
                        {item.verdict}
                      </Chip>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, item.id)}
                        className={`grid h-6 w-6 place-items-center rounded transition-colors ${
                          isConfirmingDelete
                            ? 'bg-[#c0392b] text-white'
                            : 'text-ink-faint opacity-60 hover:opacity-100 hover:bg-[#fbe6e3] hover:text-[#c0392b]'
                        }`}
                        title={isConfirmingDelete ? 'Click again to confirm delete' : 'Delete this analysis'}
                        aria-label="Delete analysis"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Input / claim preview */}
                  <div>
                    <p className="line-clamp-2 text-xs font-medium text-ink leading-relaxed">
                      {item.input_text || item.original_filename || 'Untitled analysis'}
                    </p>
                    {item.headline && (
                      <p className="mt-1 line-clamp-1 text-[11px] text-ink-faint">
                        {item.headline}
                      </p>
                    )}
                  </div>

                  {/* Bottom metrics row */}
                  <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[11px] text-ink-faint">
                    <div className="flex items-center gap-3">
                      <span>
                        Trust: <strong className="text-ink">{item.trust_score != null ? Math.round(item.trust_score) : '-'}</strong>/100
                      </span>
                      {item.confidence != null && (
                        <span>
                          Conf: <strong className="text-ink">{Math.round(item.confidence * 100)}%</strong>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={11} aria-hidden />
                      <span>{formatTimestamp(item.created_at)}</span>
                    </div>
                  </div>

                  {isConfirmingDelete && (
                    <div className="mt-1 rounded bg-[#fbe6e3] px-2 py-1 text-center text-[11px] font-bold text-[#c0392b]">
                      Click trash icon again to permanently delete
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer info */}
        <div className="border-t border-line bg-[#faf9fc] px-5 py-3 text-[11px] text-ink-faint flex items-center justify-between">
          <span>{history.length} {history.length === 1 ? 'record' : 'records'} in SQLite memory</span>
          <span className="text-[10px]">Restores instantly without AI query</span>
        </div>
      </aside>
    </>
  )
}
