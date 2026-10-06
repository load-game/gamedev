import { resolveControlInternalUrl } from './runtimeBootstrap.js'
export function admittedIdentity(network, playerId, now = Date.now()) {
  const identity = network.sockets.get(playerId)?.identity
  return identity?.expiresAt > now ? { ...identity } : null
}
export async function requestProductRecords(network, playerId, payload, facts = false) {
  const identity = admittedIdentity(network, playerId)
  if (!identity) throw new Error('Sign in with Peezy Identity to use achievements.')
  const path = facts ? '/internal/account-facts' : '/internal/product-records'
  const url =
    process.env.PRODUCT_RECORDS_GATEWAY_URL || process.env.FRIENDS_GATEWAY_URL
      ? new URL(path, process.env.PRODUCT_RECORDS_GATEWAY_URL || process.env.FRIENDS_GATEWAY_URL).toString()
      : resolveControlInternalUrl(path)
  if (!url || !(process.env.PRODUCT_RECORDS_SECRET || process.env.ADMISSION_SECRET))
    throw new Error('Achievement service unavailable. Retry shortly.')
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.PRODUCT_RECORDS_SECRET || process.env.ADMISSION_SECRET}`,
    },
    body: JSON.stringify({ ...payload, subject: identity.userId }),
    signal: AbortSignal.timeout(8000),
    redirect: 'error',
  })
  const data = await response.json()
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Achievement service unavailable.')
  if (admittedIdentity(network, playerId)?.userId !== identity.userId)
    throw new Error('Account changed. Refresh achievements.')
  if (
    !facts &&
    (data.subject !== (payload.viewSubject || identity.userId) ||
      data.scope !== payload.scope ||
      !Array.isArray(data.records) ||
      data.records.length > 256)
  )
    throw new Error('Invalid achievement response.')
  return data
}
