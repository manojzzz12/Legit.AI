import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  FileSearch,
  History,
  Info,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react'
import Header from '../components/Header.jsx'
import HeroBanner from '../components/HeroBanner.jsx'
import HistoryPanel from '../components/HistoryPanel.jsx'
import InputPanel from '../components/InputPanel.jsx'
import LoadingInvestigation from '../components/LoadingInvestigation.jsx'
import VerdictCard from '../components/VerdictCard.jsx'
import ExtractedContent from '../components/ExtractedContent.jsx'
import ClaimsPanel from '../components/ClaimsPanel.jsx'
import ManipulationPanel from '../components/ManipulationPanel.jsx'
import EvidenceSummary from '../components/EvidenceSummary.jsx'
import ContradictionPanel from '../components/ContradictionPanel.jsx'
import EvidenceList from '../components/EvidenceList.jsx'
import EvidenceTimeline from '../components/EvidenceTimeline.jsx'
import SourceReliability from '../components/SourceReliability.jsx'
import ScoreBreakdown from '../components/ScoreBreakdown.jsx'
import Conclusion from '../components/Conclusion.jsx'
import Explore from './Explore.jsx'
import {
  analyze,
  clearHistory,
  deleteHistoryItem,
  getDemos,
  getHealth,
  getHistory,
  getHistoryItem,
  runDemo,
} from '../services/api.js'

function pageFromPath(path) {
  if (path === '/explore') return 'explore'
  if (path === '/images' || path === '/photos' || path === '/image') return 'image'
  if (path === '/video') return 'video'
  if (path === '/audio') return 'audio'
  if (path === '/text') return 'text'
  return 'home'
}

export default function Dashboard() {
  const [page, setPage] = useState(() => pageFromPath(window.location.pathname))
  const [health, setHealth] = useState(null)
  const [demos, setDemos] = useState([])
  const [result, setResult] = useState(null)
  const [activeDemo, setActiveDemo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const resultsRef = useRef(null)

  // History state
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyList, setHistoryList] = useState([])
  const [historyFilter, setHistoryFilter] = useState('all')
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedHistoryId, setSelectedHistoryId] = useState(null)
  const [historyError, setHistoryError] = useState(null)

  const loadHistory = (filter = historyFilter) => {
    setLoadingHistory(true)
    setHistoryError(null)
    getHistory(filter)
      .then((items) => setHistoryList(items || []))
      .catch((err) => setHistoryError(err.message))
      .finally(() => setLoadingHistory(false))
  }

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth({ status: 'down' }))
    getDemos().then(setDemos).catch((e) => setMessage({ kind: 'error', text: e.message }))
    loadHistory('all')
  }, [])

  useEffect(() => {
    const handlePopState = () => setPage(pageFromPath(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (event, path) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (window.location.pathname !== path) window.history.pushState(null, '', path)
    setPage(pageFromPath(path))
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleFormatChange = (newFormat) => {
    const targetPath = newFormat === 'image' ? '/images' : `/${newFormat}`
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath)
    }
    setPage(newFormat)
  }

  const showResult = (data) => {
    setResult(data)
    if (data?.case_id) setSelectedHistoryId(data.case_id)
    loadHistory(historyFilter)
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const handleSelectHistory = async (id) => {
    setLoading(true)
    setMessage(null)
    try {
      const fullCase = await getHistoryItem(id)
      setSelectedHistoryId(id)
      setResult(fullCase)
      setHistoryOpen(false)
      setMessage({
        kind: 'info',
        text: `Restored saved analysis (${fullCase.input?.type || 'analysis'}) from SQLite memory. No external AI queries needed.`,
      })
      window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } catch (err) {
      setMessage({ kind: 'error', text: `Failed to load history item: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteHistory = async (id) => {
    try {
      await deleteHistoryItem(id)
      setHistoryList((prev) => prev.filter((item) => item.id !== id))
      if (selectedHistoryId === id) setSelectedHistoryId(null)
    } catch (err) {
      setHistoryError(`Failed to delete item: ${err.message}`)
    }
  }

  const handleClearHistory = async () => {
    try {
      await clearHistory()
      setHistoryList([])
      setSelectedHistoryId(null)
      setMessage({ kind: 'info', text: 'All analysis history cleared.' })
    } catch (err) {
      setHistoryError(`Failed to clear history: ${err.message}`)
    }
  }

  const handleFilterChange = (newFilter) => {
    setHistoryFilter(newFilter)
    loadHistory(newFilter)
  }

  const handleDemo = async (id) => {
    setLoading(true)
    setMessage(null)
    setActiveDemo(id)
    try {
      showResult(await runDemo(id))
    } catch (e) {
      setMessage({ kind: 'error', text: e.message })
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyze = async (kind, opts) => {
    setLoading(true)
    setMessage(null)
    setActiveDemo(null)
    const endpoint = kind === 'text' && opts.file ? 'document' : kind
    try {
      const res = await analyze(endpoint, opts)
      showResult(res)
    } catch (e) {
      const demoHint = e.body?.demo_available ? ' You can still run one of the sample checks from the hero bar.' : ''
      setMessage({ kind: e.status >= 500 || e.status === 0 ? 'error' : 'info', text: e.message + demoHint })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell flex flex-col min-h-screen bg-[#f7f5fa]">
      <Header
        health={health}
        page={page}
        onNavigate={navigate}
        historyCount={historyList.length}
        onToggleHistory={() => setHistoryOpen((p) => !p)}
        historyOpen={historyOpen}
      />

      <main className="main-content flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Hero Section & Evidentiary Pipeline Banner */}
        <HeroBanner
          demos={demos}
          activeDemo={activeDemo}
          loading={loading}
          onDemo={handleDemo}
        />

        {/* Workspace Input or Explore Page */}
        {page === 'explore' ? (
          <Explore onNavigate={navigate} />
        ) : (
          <InputPanel
            pageType={page === 'home' ? 'text' : page}
            loading={loading}
            onAnalyze={handleAnalyze}
            onFormatChange={handleFormatChange}
          />
        )}

        {/* Loading Investigation Progress HUD */}
        {loading && (
          <LoadingInvestigation kind={page} />
        )}

        {/* Feedback / Alert Notice Banner */}
        {message && (
          <div
            role="alert"
            className={`flex items-center gap-3 rounded-xl border p-4 text-xs sm:text-sm font-medium shadow-xs transition-all ${
              message.kind === 'error'
                ? 'border-[#f5c6cb] bg-[#fbf2f2] text-[#8e2525]'
                : 'border-[#c4e0f5] bg-[#f2f8fc] text-[#1b5e90]'
            }`}
          >
            {message.kind === 'error' ? (
              <AlertCircle size={18} className="shrink-0 text-[#c0392b]" aria-hidden />
            ) : (
              <Info size={18} className="shrink-0 text-[#1b5e90]" aria-hidden />
            )}
            <span className="leading-relaxed">{message.text}</span>
          </div>
        )}

        {/* Comprehensive Results Area */}
        {result && (
          <div ref={resultsRef} className="results-area mt-10 space-y-6 scroll-mt-24">
            {/* Header of results */}
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
              <div>
                <span className="font-mono text-[11px] font-extrabold uppercase tracking-widest text-[#8e2cc9]">
                  INVESTIGATION DOSSIER
                </span>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl">
                  Evidentiary Assessment Report
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#f4edf9] px-3 py-1 font-mono text-xs font-bold text-[#8e2cc9]">
                  {result.claims?.length || 0} Claims Evaluated
                </span>
              </div>
            </div>

            {/* Instant Result Cache Badge */}
            {result.from_cache && (
              <div
                role="status"
                className="flex items-center gap-2.5 rounded-xl border border-[#b4e6d6] bg-[#effbf6] px-4 py-3 text-xs text-[#0f5343] shadow-xs"
              >
                <Zap size={16} className="text-[#0e8f7e] fill-[#0e8f7e] shrink-0" aria-hidden />
                <span>
                  <strong>Instant Result:</strong> Retrieved from your recent analysis memory. Loaded directly without repeating AI or external search queries.
                </span>
              </div>
            )}

            {/* System Warnings if any */}
            {result.warnings?.length > 0 && (
              <div
                role="status"
                className="rounded-xl border border-[#f0dc9d] bg-[#fffaf0] p-4 text-xs text-[#795b10] shadow-xs"
              >
                <strong className="block font-bold">Execution Notes:</strong>
                <ul className="mt-1 list-disc pl-5 space-y-0.5">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Simulated Demo Disclaimer */}
            {result.mode === 'demo' && (
              <div className="rounded-xl border border-line bg-white p-3 text-xs text-ink-soft">
                <strong className="text-ink">Sample Demonstration:</strong> {result.demo?.label}. Evidence sources and stances are simulated fixtures; trust scoring is computed live through the real deterministic scoring engine.
              </div>
            )}

            {/* Hero Verdict Card */}
            <VerdictCard overall={result.overall} headline={result.conclusion?.headline} />

            {/* Ingested Content & Fingerprint */}
            <ExtractedContent input={result.input} />

            {/* Extracted Claims */}
            <ClaimsPanel claims={result.claims} />

            {/* Contradiction Analysis (Crucial Differentiator!) */}
            <ContradictionPanel contradictions={result.contradictions || []} />

            {/* Manipulation & Evidence Distribution Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              <ManipulationPanel manipulation={result.manipulation || {}} />
              <EvidenceSummary summary={result.evidence_summary} claims={result.claims} />
            </div>

            {/* Full Evidence Workspace */}
            <EvidenceList claims={result.claims} />

            {/* Timeline & Source Authority Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              <EvidenceTimeline trail={result.trail || []} />
              <SourceReliability claims={result.claims} heuristics={result.heuristics || {}} />
            </div>

            {/* Mathematical Score Breakdown */}
            <ScoreBreakdown overall={result.overall} />

            {/* Final Reasoned Conclusion */}
            <Conclusion conclusion={result.conclusion} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer mt-auto border-t border-line bg-white/60 py-6 text-xs text-ink-faint">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-black text-[#8e2cc9] tracking-wider text-sm">LEGIT.AI</span>
            <span>—</span>
            <span>Beyond Fake or Real. Evidence Before Conclusions.</span>
          </div>
          <span className="text-[11px]">
            Multimodal Digital Trust Verification · Anonymous &amp; Session Isolated
          </span>
        </div>
      </footer>

      {/* History Drawer */}
      <HistoryPanel
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={historyList}
        selectedId={selectedHistoryId}
        onSelect={handleSelectHistory}
        onDelete={handleDeleteHistory}
        onClearAll={handleClearHistory}
        loading={loadingHistory}
        filter={historyFilter}
        onFilterChange={handleFilterChange}
        error={historyError}
      />
    </div>
  )
}
