export function normalizeForwardedPrefix(value) {
  if (typeof value !== 'string') return ''
  const first = value.split(',')[0].trim()
  if (!first || first === '/') return ''
  const prefixed = first.startsWith('/') ? first : `/${first}`
  return prefixed.replace(/\/+$/, '')
}

export function extractRuntimePrefixFromPath(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  const [pathname] = trimmed.split('?')
  const match = pathname.match(/^(\/worlds\/[^/]+)/)
  return match ? match[1] : ''
}

export function deriveAdminUrlFromRequest(req) {
  const headers = req?.headers || {}
  let host = headers['x-forwarded-host'] || headers['host']
  if (Array.isArray(host)) host = host[0]
  if (!host) return null

  let proto = headers['x-forwarded-proto']
  if (Array.isArray(proto)) proto = proto[0]
  if (proto) proto = String(proto).split(',')[0].trim()
  if (proto === 'wss') proto = 'https'
  if (proto === 'ws') proto = 'http'
  if (!proto && req?.protocol) proto = req.protocol
  if (!proto) proto = 'https'

  let prefix = normalizeForwardedPrefix(headers['x-forwarded-prefix'])
  if (!prefix) {
    const forwardedUri = headers['x-forwarded-uri'] || headers['x-original-uri'] || headers['x-rewrite-url']
    prefix = extractRuntimePrefixFromPath(Array.isArray(forwardedUri) ? forwardedUri[0] : forwardedUri)
  }
  if (!prefix) {
    prefix = extractRuntimePrefixFromPath(req?.url)
  }

  return `${proto}://${host}${prefix}`
}
