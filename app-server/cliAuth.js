import crypto from 'crypto'
import http from 'http'
import { spawn } from 'child_process'

import { joinUrl, normalizeWorldAdminBaseUrl } from './helpers.js'
import {
  readProjectAuthEntry,
  removeProjectAuthEntry,
  writeProjectAuthEntry,
} from './projectAuth.js'

function createError(code, message = code, extra = {}) {
  const error = new Error(message)
  error.code = code
  Object.assign(error, extra)
  return error
}

function normalizeCapability(value) {
  if (value === 'deploy') return 'deploy'
  if (value === 'auth') return 'auth'
  return 'builder'
}

export function hasRequiredCapability(capabilities, requiredCapability = 'builder') {
  const required = normalizeCapability(requiredCapability)
  if (required === 'auth') return true
  if (required === 'deploy') return !!capabilities?.deploy
  return !!capabilities?.builder
}

export async function fetchCliAuthStatus({ worldUrl, authToken }) {
  const normalizedWorldUrl = normalizeWorldAdminBaseUrl(worldUrl)
  if (!normalizedWorldUrl) {
    throw createError('invalid_world_url', 'Invalid world URL')
  }
  if (typeof authToken !== 'string' || !authToken.trim()) {
    throw createError('auth_token_missing', 'Missing auth token')
  }
  const response = await fetch(joinUrl(normalizedWorldUrl, '/api/auth/cli/status'), {
    headers: {
      authorization: `Bearer ${authToken.trim()}`,
      accept: 'application/json',
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = createError(data?.error || `status_failed:${response.status}`, data?.message || 'Auth status failed', {
      status: response.status,
      data,
    })
    throw error
  }
  return data
}

function createCallbackServer({ worldId, worldUrl, state, timeoutMs = 10 * 60 * 1000 } = {}) {
  const expectedState = typeof state === 'string' && state.trim() ? state.trim() : crypto.randomUUID()
  let settled = false
  let timeoutId = null
  let server = null
  let startupResolve = null
  let startupReject = null
  let startupState = 'pending'
  const startup = new Promise((resolve, reject) => {
    startupResolve = resolve
    startupReject = reject
  })

  const close = async () => {
    if (!server) return
    const target = server
    server = null
    await new Promise(resolve => target.close(() => resolve()))
  }

  const result = new Promise((resolve, reject) => {
    server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      if (req.method === 'OPTIONS') {
        res.statusCode = 204
        res.end()
        return
      }

      if (req.method !== 'POST' || req.url !== '/callback') {
        res.statusCode = 404
        res.end('Not found')
        return
      }

      const chunks = []
      req.on('data', chunk => {
        chunks.push(chunk)
      })
      req.on('error', async error => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'callback_read_failed' }))
        await close()
        reject(error instanceof Error ? error : createError('callback_read_failed'))
      })
      req.on('end', async () => {
        let payload
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        } catch {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'invalid_payload' }))
          return
        }

        const receivedState = typeof payload?.state === 'string' ? payload.state.trim() : ''
        const authToken = typeof payload?.authToken === 'string' ? payload.authToken.trim() : ''
        const receivedWorldId = typeof payload?.worldId === 'string' ? payload.worldId.trim() : ''
        const receivedWorldUrl = typeof payload?.worldUrl === 'string' ? payload.worldUrl.trim() : ''

        if (!authToken || !receivedState || receivedState !== expectedState) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'invalid_callback_state' }))
          return
        }
        if (worldId && receivedWorldId && receivedWorldId !== worldId) {
          res.statusCode = 409
          res.end(JSON.stringify({ error: 'world_id_mismatch' }))
          return
        }
        if (worldUrl && receivedWorldUrl && normalizeWorldAdminBaseUrl(receivedWorldUrl) !== normalizeWorldAdminBaseUrl(worldUrl)) {
          res.statusCode = 409
          res.end(JSON.stringify({ error: 'world_url_mismatch' }))
          return
        }

        settled = true
        clearTimeout(timeoutId)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
        await close()
        resolve(payload)
      })
    })

    server.listen(0, '127.0.0.1', () => {
      if (startupState === 'pending') {
        startupState = 'ready'
        startupResolve()
      }
      timeoutId = setTimeout(async () => {
        if (settled) return
        settled = true
        await close()
        reject(createError('auth_timeout', 'Timed out waiting for browser authentication'))
      }, timeoutMs)
    })

    server.on('error', async error => {
      if (startupState === 'pending') {
        startupState = 'failed'
        startupReject(error instanceof Error ? error : createError('callback_server_failed'))
      }
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      await close()
      reject(error instanceof Error ? error : createError('callback_server_failed'))
    })
  })

  return {
    state: expectedState,
    async getCallbackUrl() {
      await startup
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw createError('callback_server_failed')
      }
      return `http://127.0.0.1:${address.port}/callback`
    },
    result,
    close,
  }
}

async function launchBrowser(url) {
  const commands =
    process.platform === 'darwin'
      ? [['open', [url]]]
      : process.platform === 'win32'
        ? [['cmd', ['/c', 'start', '', url]]]
        : [['xdg-open', [url]]]

  for (const [command, args] of commands) {
    const ok = await new Promise(resolve => {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
      })
      child.once('error', () => resolve(false))
      child.once('spawn', () => {
        child.unref()
        resolve(true)
      })
    })
    if (ok) return true
  }
  return false
}

export function buildCliAuthUrl({ worldUrl, worldId, callbackUrl, state, requiredCapability = 'builder' } = {}) {
  const normalizedWorldUrl = normalizeWorldAdminBaseUrl(worldUrl)
  if (!normalizedWorldUrl) {
    throw createError('invalid_world_url', 'Invalid world URL')
  }
  const url = new URL(joinUrl(normalizedWorldUrl, '/auth/cli'))
  if (callbackUrl) url.searchParams.set('callback', callbackUrl)
  if (worldId) url.searchParams.set('worldId', worldId)
  if (state) url.searchParams.set('state', state)
  url.searchParams.set('required', normalizeCapability(requiredCapability))
  return url.toString()
}

export async function runBrowserCliAuth({
  rootDir = process.cwd(),
  worldUrl,
  worldId,
  requiredCapability = 'builder',
  timeoutMs,
  log = console,
} = {}) {
  const callback = createCallbackServer({
    worldId,
    worldUrl,
    timeoutMs,
  })
  try {
    const callbackUrl = await callback.getCallbackUrl()
    const authUrl = buildCliAuthUrl({
      worldUrl,
      worldId,
      callbackUrl,
      state: callback.state,
      requiredCapability,
    })

    log?.log?.(`World auth URL:\n${authUrl}`)
    const opened = await launchBrowser(authUrl)
    if (!opened) {
      log?.warn?.('Browser did not open automatically. Open the URL above to continue authentication.')
    } else {
      log?.log?.(`Opening browser for world auth...`)
    }

    const payload = await callback.result
    const entry = writeProjectAuthEntry(rootDir, {
      worldUrl: payload.worldUrl || worldUrl,
      worldId: payload.worldId || worldId,
      authToken: payload.authToken,
      userId: payload?.user?.id || null,
      userName: payload?.user?.name || null,
    })
    return {
      entry,
      capabilities: payload?.capabilities || null,
    }
  } finally {
    await callback.close().catch(() => {})
  }
}

export async function ensureProjectAuth({
  rootDir = process.cwd(),
  worldUrl,
  worldId,
  requiredCapability = 'builder',
  interactive = process.stdin.isTTY,
  log = console,
} = {}) {
  const existing = readProjectAuthEntry(rootDir, { worldUrl, worldId })
  if (existing?.authToken) {
    try {
      const status = await fetchCliAuthStatus({
        worldUrl,
        authToken: existing.authToken,
      })
      if (hasRequiredCapability(status.capabilities, requiredCapability)) {
        return {
          entry: existing,
          status,
        }
      }
      if (!interactive) {
        throw createError('capability_required', 'Authenticated user lacks required world permission', {
          capabilities: status.capabilities,
        })
      }
    } catch (error) {
      const code = error?.code || ''
      if (code === 'invalid_token' || code === 'auth_token_missing' || code === 'auth_required' || code === 'status_failed:401') {
        removeProjectAuthEntry(rootDir, { worldUrl, worldId })
      } else if (!interactive) {
        throw error
      }
    }
  }

  if (!interactive) {
    throw createError(
      'auth_required',
      `Authentication required for ${worldId || worldUrl}. Run "gamedev auth" in a terminal.`,
    )
  }

  const result = await runBrowserCliAuth({
    rootDir,
    worldUrl,
    worldId,
    requiredCapability,
    log,
  })
  const status = await fetchCliAuthStatus({
    worldUrl,
    authToken: result.entry.authToken,
  })
  if (!hasRequiredCapability(status.capabilities, requiredCapability)) {
    throw createError('capability_required', 'Authenticated user lacks required world permission', {
      capabilities: status.capabilities,
    })
  }
  return {
    entry: result.entry,
    status,
  }
}
