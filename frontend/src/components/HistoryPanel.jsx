import { useState } from 'react'
import {
  AlertCircle,
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
    return d.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out border-l border-line"
        role="dialog"
        aria-modal="true"
        aria-label="Analysis History Drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4 bg-[#fbf9fe]">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#f2e7fa] text-[#8e2cc9] shadow-xs">
              <History size={18} aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-ink">
                Investigation History
              </h2>
              <p className="text-xs text-ink-faint">
                Session memory &amp; instant cache
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllClick}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  confirmClearAll
                    ? 'bg-[#c0392b] text-white shadow-xs'
                    : 'text-ink-faint hover:bg-[#fbe6e3] hover:text-[#c0392b]'
                }`}
                title="Clear all saved analyses in this session"
              >
                {confirmClearAll ? 'Confirm Clear All?' : 'Clear all'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-paper hover:text-ink cursor-pointer"
              aria-label="Close history drawer"
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
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-[#221835] text-white shadow-xs'
                    : 'bg-white text-ink-soft hover:bg-[#f0ebf7] hover:text-ink border border-line/70'
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
            <div className="rounded-xl border border-[#f5c6cb] bg-[#f8d7da] p-3 text-xs text-[#721c24] flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex h-44 flex-col items-center justify-center gap-2 text-ink-faint">
              <Loader2 size={24} className="animate-spin text-[#8e2cc9]" />
              <span className="text-xs font-medium">Restoring history...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center text-ink-faint">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#faf5fe] text-[#8e2cc9]/60">
                <Database size={26} />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">No investigations yet</p>
                <p className="mt-1 text-xs text-ink-faint max-w-xs">
                  {filter === 'all'
                    ? 'Your completed analyses will appear here. Past runs can be restored instantly without repeated AI calls.'
                    : `No ${filter} analyses found. Run a check to record an analysis.`}
                </p>
              </div>
            </div>
          ) : (
            history.map((item) => {
              const style =
                DECISION_STYLE[item.verdict] || DECISION_STYLE['INCONCLUSIVE']
              const Icon = TYPE_ICONS[item.analysis_type] || FileText
              const isSelected = selectedId === item.id
              const isConfirmingDelete = deleteConfirmId === item.id

              return (
                <div
                  key={item.id}
                  onClick={() => handleCardClick(item.id)}
                  className={`group relative flex cursor-pointer flex-col gap-2.5 rounded-xl border p-4 transition-all ${
                    isSelected
                      ? 'border-[#8e2cc9] bg-[#faf3fd] ring-2 ring-[#8e2cc9]/25 shadow-sm'
                      : 'border-line bg-white hover:border-[#cfb7dc] hover:bg-[#fdfbfe] hover:shadow-xs'
                  }`}
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#f4edf9] px-2 py-0.5 font-mono text-[10px] font-bold text-[#8e2cc9] capitalize">
                        <Icon size={12} aria-hidden />
                        {item.analysis_type}
                      </span>

                      {item.from_cache && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-md bg-[#e8f8f2] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#16866b]"
                          title="Instant Result (cached in memory)"
                        >
                          <Zap size={10} aria-hidden />
                          Instant Result
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Chip
                        color={style.color}
                        tint={style.tint}
                        border={style.border}
                        className="text-[10px]"
                      >
                        {item.verdict}
                      </Chip>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, item.id)}
                        className={`grid h-6 w-6 place-items-center rounded-lg transition-colors cursor-pointer ${
                          isConfirmingDelete
                            ? 'bg-[#c0392b] text-white'
                            : 'text-ink-faint opacity-50 group-hover:opacity-100 hover:bg-[#fbe6e3] hover:text-[#c0392b]'
                        }`}
                        title={
                          isConfirmingDelete
                            ? 'Click again to confirm delete'
                            : 'Delete this record'
                        }
                        aria-label="Delete analysis"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Input / claim preview */}
                  <div>
                    <p className="line-clamp-2 text-xs font-semibold text-ink leading-relaxed">
                      {item.input_text || item.original_filename || 'Untitled investigation'}
                    </p>
                    {item.headline && (
                      <p className="mt-1 line-clamp-1 font-serif text-[11px] text-ink-soft italic">
                        {item.headline}
                      </p>
                    )}
                  </div>

                  {/* Bottom metrics row */}
                  <div className="flex items-center justify-between border-t border-line/60 pt-2 text-[11px] text-ink-faint">
                    <div className="flex items-center gap-3">
                      <span>
                        Trust Score:{' '}
                        <strong className="font-mono text-ink">
                          {item.trust_score != null ? Math.round(item.trust_score) : '-'}
                        </strong>
                        /100
                      </span>
                      {item.confidence != null && (
                        <span>
                          Conf:{' '}
                          <strong className="font-mono text-ink">
                            {Math.round(item.confidence * 100)}%
                          </strong>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      <Clock size={11} aria-hidden />
                      <span>{formatTimestamp(item.created_at)}</span>
                    </div>
                  </div>

                  {isConfirmingDelete && (
                    <div className="mt-1 rounded-lg bg-[#fbe6e3] px-2 py-1 text-center font-mono text-[10px] font-bold text-[#c0392b]">
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
          <span className="font-medium">
            {history.length} {history.length === 1 ? 'record' : 'records'} in SQLite storage
          </span>
          <span className="font-mono text-[10px] text-[#8e2cc9] font-bold">
            Session Isolated
          </span>
        </div>
      </aside>
    </>
  )
}
