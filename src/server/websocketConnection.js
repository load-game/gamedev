function isNodeStyleWebSocket(connection) {
  return (
    connection
    && typeof connection.on === 'function'
    && typeof connection.send === 'function'
  )
}

function isEventTargetStyleWebSocket(connection) {
  return (
    connection
    && typeof connection.addEventListener === 'function'
    && typeof connection.send === 'function'
  )
}

function adaptEventTargetWebSocket(connection) {
  return {
    raw: connection,
    on(eventName, handler) {
      if (typeof handler !== 'function') return this
      connection.addEventListener(eventName, event => {
        if (eventName === 'message') {
          handler(event?.data)
          return
        }
        handler(event)
      })
      return this
    },
    send(data) {
      return connection.send(data)
    },
    close(code, reason) {
      return connection.close?.(code, reason)
    },
    terminate() {
      return connection.close?.()
    },
    ping() {},
  }
}

export function describeWebSocketConnection(connection) {
  return {
    connectionType: typeof connection,
    constructorName: connection?.constructor?.name || null,
    keys:
      connection && typeof connection === 'object'
        ? Object.keys(connection).slice(0, 12)
        : [],
  }
}

export function resolveWebSocketConnection(connection) {
  const candidates = [
    connection,
    connection?.socket,
    connection?.websocket,
    connection?.ws,
  ]

  for (const candidate of candidates) {
    if (isNodeStyleWebSocket(candidate)) {
      return candidate
    }
    if (isEventTargetStyleWebSocket(candidate)) {
      return adaptEventTargetWebSocket(candidate)
    }
  }

  return null
}
