import { Activity, AudioLines, CheckCircle2, Compass, FileText, History, Image as ImageIcon, Video, Zap } from 'lucide-react'
import BrandLogo from './BrandLogo.jsx'

const NAV_ITEMS = [
  { href: '/text', label: 'Text', Icon: FileText, pageKey: 'text' },
  { href: '/images', label: 'Images', Icon: ImageIcon, pageKey: 'image' },
  { href: '/video', label: 'Video', Icon: Video, pageKey: 'video' },
  { href: '/audio', label: 'Audio', Icon: AudioLines, pageKey: 'audio' },
  { href: '/explore', label: 'Explore', Icon: Compass, pageKey: 'explore' },
]

export default function Header({
  health,
  page,
  onNavigate,
  historyCount = 0,
  onToggleHistory,
  historyOpen = false,
}) {
  const isOnline = health?.status === 'ok'
  const isLiveMode = health?.mode === 'live-ready'
  const isConnecting = health == null

  return (
    <header className="app-header sticky top-0 z-30 border-b border-[#2d253a] bg-[#100d1c]/95 backdrop-blur-md">
      <div className="header-inner flex min-h-[72px] items-center justify-between gap-4 px-4 sm:px-6 max-w-7xl mx-auto">
        {/* Brand Logo & Tagline */}
        <a
          href="/"
          className="brand flex items-center gap-3 no-underline group"
          onClick={(e) => onNavigate(e, '/')}
        >
          <div className="relative">
            <BrandLogo className="brand-logo w-9 h-9 sm:w-10 sm:h-10 transition-transform duration-300 group-hover:scale-105" />
          </div>
          <div>
            <div className="brand-name flex items-baseline font-black tracking-wider text-white text-lg sm:text-xl">
              LEGIT<span className="text-[#c42bc8]">.AI</span>
            </div>
            <div className="hidden sm:block text-[10px] font-medium tracking-wide text-[#b5a9cc]">
              Beyond Fake or Real.
            </div>
          </div>
        </a>

        {/* Navigation Tabs */}
        <nav className="main-nav hidden md:flex items-center gap-1.5" aria-label="Main navigation">
          {NAV_ITEMS.map(({ href, label, Icon, pageKey }) => {
            const isActive = page === pageKey
            return (
              <a
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#291b3b] text-[#f2a7fa] shadow-xs ring-1 ring-[#c42bc8]/30'
                    : 'text-[#aaa1bc] hover:bg-[#201830] hover:text-white'
                }`}
                onClick={(e) => onNavigate(e, href)}
              >
                <Icon size={14} aria-hidden />
                <span>{label}</span>
              </a>
            )
          })}
        </nav>

        {/* Header Actions: History & System Status */}
        <div className="header-status flex items-center gap-3">
          {/* History Button */}
          <button
            type="button"
            onClick={onToggleHistory}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              historyOpen
                ? 'bg-[#8e2cc9] text-white shadow-sm ring-2 ring-[#8e2cc9]/40'
                : 'bg-[#211a30] text-[#e0d6ed] hover:bg-[#302545] hover:text-white border border-[#382b4f]'
            }`}
            title="Open Analysis History"
          >
            <History size={14} aria-hidden />
            <span>History</span>
            {historyCount > 0 && (
              <span className="rounded-full bg-[#c42bc8] px-1.5 py-0.2 font-mono text-[10px] font-black text-white">
                {historyCount}
              </span>
            )}
          </button>

          {/* Honest System Status Indicator */}
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold tracking-wide border transition-all ${
              isConnecting
                ? 'border-[#514366] bg-[#1f172d] text-[#a499bc]'
                : isOnline
                ? 'border-[#1b4e42] bg-[#0c241f] text-[#4edbb0]'
                : 'border-[#5c2420] bg-[#271210] text-[#f07b71]'
            }`}
            title={
              isOnline
                ? `System Ready · ${isLiveMode ? 'Live Verification Online' : 'Demo Engine Ready'} (v${health.version || '0.2'})`
                : 'Backend Disconnected · Check uvicorn server'
            }
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isConnecting
                  ? 'bg-amber-400 animate-pulse'
                  : isOnline
                  ? 'bg-[#1be2a6] shadow-[0_0_8px_#1be2a6]'
                  : 'bg-red-500'
              }`}
            />
            <span className="uppercase text-[10px]">
              {isConnecting
                ? 'CONNECTING'
                : isOnline
                ? 'SYSTEM READY'
                : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
