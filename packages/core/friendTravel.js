// Reserve before leaving the current city. Tickets stay in this tab and never enter URLs/history.
export async function reserveFriendTravel(token, env = globalThis) {
  if (!env.env?.PUBLIC_JOIN_URL) throw new Error('friends_join_unavailable')
  const tabId = env.sessionStorage.getItem('lobbyTab')
  if (!tabId) throw new Error('friends_join_unavailable')
  const response = await env.fetch(env.env.PUBLIC_JOIN_URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', 'x-lobby-tab': tabId },
    body: JSON.stringify({ friendToken: token }),
    signal: AbortSignal.timeout(15000),
  })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || 'join_unavailable')
  if (!value.wsUrl || !value.ticket || !value.expiresAt) throw new Error('join_unavailable')
  env.sessionStorage.setItem('friendAssignment', JSON.stringify(value))
  return value
}
export function takeFriendTravel(env = globalThis) {
  const raw = env.sessionStorage.getItem('friendAssignment')
  env.sessionStorage.removeItem('friendAssignment')
  if (!raw) return null
  const value = JSON.parse(raw)
  if (value.expiresAt <= Date.now()) throw new Error('friend_join_expired')
  return value
}
