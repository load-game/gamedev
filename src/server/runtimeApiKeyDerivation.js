import crypto from 'crypto'

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function deriveRuntimeInternalApiKey(worldId, jwtSecret) {
  if (!hasValue(worldId) || !hasValue(jwtSecret)) return null
  return crypto
    .createHmac('sha256', jwtSecret.trim())
    .update(`runtime-internal:${worldId.trim()}`)
    .digest('hex')
}

export function isRuntimeInternalApiKeyValid(worldId, jwtSecret, key) {
  if (!hasValue(key)) return false
  const expected = deriveRuntimeInternalApiKey(worldId, jwtSecret)
  if (!hasValue(expected)) return false
  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(key.trim())
  if (expectedBuf.length !== providedBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, providedBuf)
}
