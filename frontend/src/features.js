import { AudioLines, FileText, Image as ImageIcon, Video } from 'lucide-react'

export const FEATURES = [
  { href: '/text', title: 'Fact-check text', shortLabel: 'Text', actionLabel: 'Open text check', description: 'Verify a claim, article, or document.', Icon: FileText, color: 'violet', signal: 'Claims and context' },
  { href: '/images', title: 'Inspect images', shortLabel: 'Images', actionLabel: 'Open image check', description: 'Check photos, screenshots, and graphics.', Icon: ImageIcon, color: 'blue', signal: 'Image context' },
  { href: '/video', title: 'Analyze video', shortLabel: 'Video', actionLabel: 'Open video check', description: 'Review spoken claims and sampled frames.', Icon: Video, color: 'pink', signal: 'Transcript and frames' },
  { href: '/audio', title: 'Review audio', shortLabel: 'Audio', actionLabel: 'Open audio check', description: 'Check spoken content against evidence.', Icon: AudioLines, color: 'amber', signal: 'Audio transcript' },
]
