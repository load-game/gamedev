import { randomUUID } from 'node:crypto'

// Never relay identity, timestamps, control metadata, or message IDs supplied
// by the sender. Consumers may use this identity for owner-only chat controls.
export function authenticatedChatMessage(socket, input) {
  if (!socket.player || typeof input?.body !== 'string') return null
  const body = input.body.trim()
  if (!body || body.length > 1500) return null
  return {
    id: randomUUID(),
    from: socket.player.data.name,
    fromId: socket.id,
    body,
    createdAt: new Date().toISOString(),
  }
}
