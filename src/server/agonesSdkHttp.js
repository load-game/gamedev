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
    shutdown() {
      return request('/shutdown')
    },
  }
}
