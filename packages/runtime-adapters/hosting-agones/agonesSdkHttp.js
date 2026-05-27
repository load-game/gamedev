export const AGONES_SDK_DEFAULT_HTTP_PORT = 9358

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function hasValue(value) {
  return normalizeString(value).length > 0
}

function isTruthyEnvFlag(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function inferRuntimeBootstrap(env = process.env) {
  if (isTruthyEnvFlag(env.RUNTIME_BOOTSTRAP)) return true
  return !hasValue(env.WORLD_ID) && (hasValue(env.RUNTIME_BOOTSTRAP_INSTANCE_ID) || hasValue(env.POD_NAME))
}

function normalizeHttpPort(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : AGONES_SDK_DEFAULT_HTTP_PORT
}

export function isAgonesSdkHttpEnabled(env = process.env) {
  const provider = normalizeString(env.RUNTIME_HOSTING_PROVIDER).toLowerCase()
  if (provider && provider !== 'agones') return false
  if (provider === 'agones') return true
  return inferRuntimeBootstrap(env)
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
    async getList(name) {
      const response = await request(`/v1beta1/lists/${encodeURIComponent(name)}`, {
        method: 'GET',
      })
      return readJsonResponse(response)
    },

    async updateList(name, body) {
      const response = await request(`/v1beta1/lists/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        body,
      })
      return readJsonResponse(response)
    },

    async addListValue(name, value) {
      const response = await request(`/v1beta1/lists/${encodeURIComponent(name)}:addValue`, {
        body: { value },
      })
      return readJsonResponse(response)
    },

    async removeListValue(name, value) {
      const response = await request(`/v1beta1/lists/${encodeURIComponent(name)}:removeValue`, {
        body: { value },
      })
      return readJsonResponse(response)
    },
    shutdown() {
      return request('/shutdown')
    },
  }
}

export function createAgonesHostingAdapter(options = {}) {
  const sdk = createAgonesSdkHttp(options)
  if (!sdk) return null
  return {
    name: 'agones',
    enabled: true,
    baseUrl: sdk.baseUrl,
    ready: () => sdk.ready(),
    shutdown: () => sdk.shutdown(),
    async publishPlayerCapacity(capacity) {
      return sdk.updateList('players', {
        capacity: String(capacity),
      })
    },
    trackPlayerConnect(playerId) {
      return sdk.addListValue('players', playerId)
    },
    trackPlayerDisconnect(playerId) {
      return sdk.removeListValue('players', playerId)
    },
    sdk,
  }
}
