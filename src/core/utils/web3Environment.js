/**
 * Web3 Environment Detection Utility
 * Consolidates environment detection logic duplicated across web3 systems.
 */

// Cache user agent to avoid repeated access
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''

export const isBrowser = () => typeof window !== 'undefined'

export const hasLocalStorage = () => {
  try { return typeof localStorage !== 'undefined' && localStorage !== null }
  catch { return false }
}

export const hasWebSocket = () => typeof WebSocket !== 'undefined'

export const isSecureContext = () => {
  if (!isBrowser()) return false
  try {
    return location.protocol === 'https:' ||
           location.hostname === 'localhost' ||
           location.hostname === '127.0.0.1'
  } catch { return false }
}

export const getUserAgent = () => ua

export const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)

export const isQuest = () => /OculusBrowser/.test(ua)

export const isSafari = () => /^((?!chrome|android).)*safari/i.test(ua)

export const detectEnvironment = () => ({
  isBrowser: isBrowser(),
  hasWindow: isBrowser(),
  hasLocalStorage: hasLocalStorage(),
  hasWebSocket: hasWebSocket(),
  isSecureContext: isSecureContext(),
  userAgent: ua,
  isMobile: isMobile(),
  isQuest: isQuest(),
  isSafari: isSafari(),
  location: isBrowser() ? {
    protocol: typeof location !== 'undefined' ? location.protocol : 'unknown',
    hostname: typeof location !== 'undefined' ? location.hostname : 'unknown',
    href: typeof location !== 'undefined' ? location.href : 'unknown'
  } : null,
  timestamp: Date.now()
})

export const validateBrowser = (requiredFeatures = []) => {
  const capabilities = detectEnvironment()
  const missing = []

  for (const feature of requiredFeatures) {
    switch (feature) {
      case 'browser':
      case 'window':
        if (!capabilities.isBrowser) missing.push('Browser environment (window object)')
        break
      case 'localStorage':
        if (!capabilities.hasLocalStorage) missing.push('LocalStorage access')
        break
      case 'websocket':
        if (!capabilities.hasWebSocket) missing.push('WebSocket support')
        break
      case 'secure':
        if (!capabilities.isSecureContext) missing.push('Secure context (https or localhost)')
        break
      default:
        console.warn(`[web3Environment] Unknown required feature: ${feature}`)
    }
  }

  if (missing.length > 0) {
    const error = new Error(`WEB3 ENVIRONMENT ERROR: Missing required features: ${missing.join(', ')}`)
    error.details = { missing, capabilities }
    throw error
  }
}

export const web3Environment = {
  isBrowser,
  hasLocalStorage,
  hasWebSocket,
  isSecureContext,
  getUserAgent,
  isMobile,
  isQuest,
  isSafari,
  detectEnvironment,
  validateBrowser
}
