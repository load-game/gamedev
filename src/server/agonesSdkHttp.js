import { usesHostedRuntimeBootstrap } from './runtimeBootstrap.js'

export const AGONES_SDK_DEFAULT_HTTP_PORT = 9358

function normalizeHttpPort(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : AGONES_SDK_DEFAULT_HTTP_PORT
}

export function isAgonesSdkHttpEnabled(env = process.env) {
  return usesHostedRuntimeBootstrap(env)
}

export function resolveAgonesSdkHttpBaseUrl(env = process.env) {
  const port = normalizeHttpPort(env?.AGONES_SDK_HTTP_PORT)
  return `http://127.0.0.1:${port}`
}

function createAgonesSdkHttpRequest({ baseUrl, fetchImpl }) {
  return async function request(pathname, { method = 'POST', body } = {}) {
    const url = new URL(pathname, `${baseUrl}/`).toString()
    const options = { method }
    if (body !== undefined) {
      options.body = JSON.stringify(body)
      options.headers = {
        'content-type': 'application/json',
      }
    }
    const response = await fetchImpl(url, options)
    if (!response?.ok) {
      throw new Error(`agones_sdk_status_${response?.status ?? 'unknown'}`)
    }
    return response
  }
}

async function readJsonResponse(response) {
  if (typeof response?.json !== 'function') return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

function normalizeAgonesBool(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return true
}

export function createAgonesSdkHttp({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!isAgonesSdkHttpEnabled(env) || typeof fetchImpl !== 'function') {
    return null
  }

  const baseUrl = resolveAgonesSdkHttpBaseUrl(env)
  const request = createAgonesSdkHttpRequest({ baseUrl, fetchImpl })

  return {
    enabled: true,
    baseUrl,
    ready() {
      return request('/ready')
    },
    async setPlayerCapacity(count) {
      return request('/alpha/player/capacity', {
        method: 'PUT',
        body: { count },
      })
    },
    async playerConnect(playerID) {
      const response = await request('/alpha/player/connect', {
        body: { playerID },
      })
      const payload = await readJsonResponse(response)
      return normalizeAgonesBool(payload?.bool)
    },
    async playerDisconnect(playerID) {
      const response = await request('/alpha/player/disconnect', {
        body: { playerID },
      })
      const payload = await readJsonResponse(response)
      return normalizeAgonesBool(payload?.bool)
    },
    shutdown() {
      return request('/shutdown')
    },
  }
}
