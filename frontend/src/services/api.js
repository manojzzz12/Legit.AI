import { getSessionId } from './session'

// All backend calls live here. The frontend never sees any API key:
// Gemini and Tavily keys stay in backend/.env.
const BASE = import.meta.env.VITE_API_URL || '/api'

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function request(path, options = {}) {
  let res
  const headers = {
    ...(options.headers || {}),
    'X-Session-ID': getSessionId(),
  }
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers })
  } catch {
    throw new ApiError('Cannot reach the backend. Start it with: uvicorn main:app --port 8000', 0, null)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(body?.detail || body?.message || `Request failed (${res.status})`, res.status, body)
  return body
}

export const getHealth = () => request('/health')
export const getDemos = () => request('/demo')
export const runDemo = (id) => request(`/demo/${id}`)

export const getHistory = (type) =>
  request(type && type.toLowerCase() !== 'all' ? `/history?type=${encodeURIComponent(type)}` : '/history')
export const getHistoryItem = (id) => request(`/history/${id}`)
export const deleteHistoryItem = (id) => request(`/history/${id}`, { method: 'DELETE' })
export const clearHistory = () => request('/history', { method: 'DELETE' })

// Every live analysis is a multipart form so the same code path handles text, documents,
// media and optional reference evidence. Keys stay on the backend.
// opts: { text, file, transcript, referenceText, referenceFiles }
export const analyze = (kind, opts) => {
  const form = new FormData()
  if (opts.file) form.append('file', opts.file)
  if (kind === 'text') form.append('text', opts.text || '')
  if (kind === 'image' && opts.transcript) form.append('caption', opts.transcript)
  if ((kind === 'audio' || kind === 'video') && opts.transcript) form.append('transcript', opts.transcript)
  if (opts.referenceText) form.append('reference_text', opts.referenceText)
  ;(opts.referenceFiles || []).forEach((f) => form.append('references', f))
  return request(`/analyze/${kind}`, { method: 'POST', body: form })
}
