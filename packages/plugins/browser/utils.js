/* global env */

/**
 *
 * Hash File
 *
 * takes a file and generates a sha256 unique hash.
 * carefully does this the same way as the server function.
 *
 */
export async function hashFile(file) {
  const buf = await file.arrayBuffer()
  const hashBuf = await crypto.subtle.digest('SHA-256', buf)
  const hash = Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return hash
}

export function sanitizeWsUrl(urlString) {
  try {
    const parsed = new URL(urlString)
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') return null
    return parsed.origin + parsed.pathname
  } catch {
    return null
  }
}

export function isServerUrlOverrideAllowed() {
  return location.hostname === 'localhost' || env.PUBLIC_ALLOW_WS_OVERRIDE === 'true'
}

export function resolveConnectionPolicy() {
  const searchParams = new URLSearchParams(location.search)
  const allowUrlOverride = isServerUrlOverrideAllowed()
  if (searchParams.get('mode') === 'offline') return { offline: true, allowUrlOverride }
  if (allowUrlOverride) {
    const connectUrl = searchParams.get('connect')
    if (connectUrl) {
      const overrideWsUrl = sanitizeWsUrl(connectUrl)
      if (overrideWsUrl) return { allowUrlOverride, overrideWsUrl }
    }
  }
  // No server configured — don't guess from window.location, just go offline
  if (!env.PUBLIC_WS_URL && !env.PUBLIC_API_URL) return { offline: true, allowUrlOverride }
  return { allowUrlOverride }
}

export function getPreferredServerUrl() {
  const connectionPolicy = resolveConnectionPolicy()
  if (connectionPolicy.overrideWsUrl) return connectionPolicy.overrideWsUrl
  return env.PUBLIC_WS_URL || ''
}

export function navigateToServer(wsUrl) {
  const url = new URL(location.href)
  url.searchParams.delete('mode')
  if (wsUrl) {
    url.searchParams.set('connect', wsUrl)
  } else {
    url.searchParams.delete('connect')
  }
  location.href = url.toString()
}
