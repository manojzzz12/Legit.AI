// Manages persistent anonymous browser session identity for Legit.ai.
// Uses localStorage to preserve session across reloads without requiring user accounts or logins.

const SESSION_STORAGE_KEY = 'legit_ai_session_id'
const SESSION_REGEX = /^[a-zA-Z0-9_-]{8,128}$/

function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16),
    )
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Returns the current persistent anonymous session ID.
 * Generates and stores a new UUID if none exists or if corrupted.
 */
export function getSessionId() {
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (existing && SESSION_REGEX.test(existing.trim())) {
      return existing.trim()
    }
    const freshId = generateUuid()
    window.localStorage.setItem(SESSION_STORAGE_KEY, freshId)
    return freshId
  } catch {
    // Fallback if localStorage is disabled or restricted
    return generateUuid()
  }
}
