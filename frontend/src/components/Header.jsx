import { Activity, AudioLines, Compass, FileText, History, Image as ImageIcon, Video } from 'lucide-react'
import BrandLogo from './BrandLogo.jsx'

const NAV_ITEMS = [
  { href: '/explore', label: 'Explore', Icon: Compass },
  { href: '/text', label: 'Text', Icon: FileText },
  { href: '/images', label: 'Images', Icon: ImageIcon },
  { href: '/video', label: 'Video', Icon: Video },
  { href: '/audio', label: 'Audio', Icon: AudioLines },
]

export default function Header({ health, page, onNavigate, historyCount = 0, onToggleHistory, historyOpen = false }) {
  const ok = health?.status === 'ok'
  const modeLabel = health == null ? 'Connecting' : health.mode === 'live-ready' ? 'Live mode' : 'Demo mode'
  return (
    <header className="app-header">
      <div className="header-inner">
        <a href="/" className="brand" onClick={(e) => onNavigate(e, '/')}>
          <BrandLogo className="brand-logo" />
          <span className="brand-name">LEGIT<span>.AI</span></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const routePage = href === '/images' ? 'image' : href.slice(1)
            return (
              <a
                key={href}
                href={href}
                aria-current={page === routePage ? 'page' : undefined}
                className={`nav-link ${page === routePage ? 'nav-link-active' : ''}`}
                onClick={(e) => onNavigate(e, href)}
              >
                <Icon size={16} aria-hidden /> {label}
              </a>
            )
          })}
        </nav>
        <div className="header-status">
          <button
            type="button"
            onClick={onToggleHistory}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              historyOpen
                ? 'bg-[#8e2cc9] text-white shadow-sm'
                : 'bg-[#282034] text-[#e0d6ed] hover:bg-[#382b4a] hover:text-white'
            }`}
            title="Open Analysis History"
          >
            <History size={14} aria-hidden />
            <span>History</span>
            {historyCount > 0 && (
              <span className="ml-0.5 rounded-full bg-[#c42bc8] px-1.5 py-0.2 text-[10px] text-white font-black">
                {historyCount}
              </span>
            )}
          </button>
          <span className={`mode-pill ${health?.mode === 'live-ready' ? 'mode-live' : ''}`}>{modeLabel}</span>
          <span className={`connection-status ${ok ? 'connection-online' : ''}`} title="Backend health">
            <Activity size={14} aria-hidden /> <span className="connection-label">{health == null ? 'Connecting' : ok ? 'Online' : 'Offline'}</span>
          </span>
        </div>
      </div>
    </header>
  )
}
