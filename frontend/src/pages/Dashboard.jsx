import { useEffect, useRef, useState } from 'react'
import { AlertCircle, History, Info, Zap } from 'lucide-react'
import Header from '../components/Header.jsx'
import HistoryPanel from '../components/HistoryPanel.jsx'
import InputPanel from '../components/InputPanel.jsx'
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
import Home from './Home.jsx'
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

  const showResult = (data) => {
    setResult(data)
    if (data?.case_id) setSelectedHistoryId(data.case_id)
    loadHistory(historyFilter)
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
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
        text: `Restored saved analysis (${fullCase.input?.type || 'analysis'}) from SQLite memory. No AI queries needed.`,
      })
      window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
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
      const demoHint = e.body?.demo_available ? ' You can still run one of the sample checks from the home page.' : ''
      setMessage({ kind: e.status >= 500 || e.status === 0 ? 'error' : 'info', text: e.message + demoHint })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <Header
        health={health}
        page={page}
        onNavigate={navigate}
        historyCount={historyList.length}
        onToggleHistory={() => setHistoryOpen((p) => !p)}
        historyOpen={historyOpen}
      />
      <main className={`main-content ${page === 'home' ? 'main-home' : ''}`}>
        {page === 'home'
          ? <Home demos={demos} loading={loading} activeDemo={activeDemo} onDemo={handleDemo} onNavigate={navigate} />
          : page === 'explore'
            ? <Explore onNavigate={navigate} />
            : <InputPanel pageType={page} loading={loading} onAnalyze={handleAnalyze} />}

        {message && (
          <div role="alert" className={`notice ${message.kind === 'error' ? 'notice-error' : 'notice-info'}`}>
            {message.kind === 'error' ? <AlertCircle size={18} className="notice-icon" aria-hidden /> : <Info size={18} className="notice-icon" aria-hidden />}
            {message.text}
          </div>
        )}

        {result && (
          <div ref={resultsRef} className="results-area">
            <div className="results-heading"><span className="eyebrow">YOUR ANALYSIS</span><h2>Evidence review</h2></div>
            {result.from_cache && (
              <div role="status" className="notice notice-info mb-4">
                <Zap size={16} className="notice-icon text-[#16866b]" aria-hidden />
                <span>
                  <strong>Instant cached result:</strong> Loaded directly from memory cache without repeating AI or web search queries.
                </span>
              </div>
            )}
            {result.warnings?.length > 0 && (
              <div role="status" className="result-warning">
                <strong>Some steps ran with limits:</strong>
                <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </div>
            )}
            {result.mode === 'demo' && (
              <p className="demo-disclaimer"><strong>Sample check:</strong> {result.demo?.label}. Sources and classifications are simulated; scoring is calculated live.</p>
            )}
            <VerdictCard overall={result.overall} headline={result.conclusion.headline} />
            <ExtractedContent input={result.input} />
            <ClaimsPanel claims={result.claims} />
            <div className="result-grid">
              <ManipulationPanel manipulation={result.manipulation} />
              <EvidenceSummary summary={result.evidence_summary} claims={result.claims} />
            </div>
            <ContradictionPanel contradictions={result.contradictions} />
            <EvidenceList claims={result.claims} />
            <div className="result-grid">
              <EvidenceTimeline trail={result.trail} />
              <SourceReliability claims={result.claims} heuristics={result.heuristics} />
            </div>
            <ScoreBreakdown overall={result.overall} />
            <Conclusion conclusion={result.conclusion} />
          </div>
        )}
      </main>
      <footer className="app-footer">
        <span className="footer-brand">LEGIT.AI</span>
        <span>Evidence can be incomplete. Use this as a helpful signal, not proof that content is real or fake.</span>
      </footer>

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
