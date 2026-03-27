import { createJWT, readJWT } from '../core/utils-server.js'
import { Ranks } from '../core/extras/ranks'
import { uuid } from '../core/utils'

function normalizeString(value) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function hasValue(value) {
  return normalizeString(value).length > 0
}

function hasAdminCodeConfigured(adminCode = process.env.ADMIN_CODE) {
  return hasValue(adminCode)
}

function getAuthTokenFromAuthorizationHeader(value) {
  const normalized = normalizeString(value)
  if (!normalized.startsWith('Bearer ')) return ''
  return normalizeString(normalized.slice(7))
}

function parseUserRank(value) {
  const rank = Number(value)
  return Number.isFinite(rank) ? rank : Ranks.VISITOR
}

function buildCapabilities(rank, { adminCode = process.env.ADMIN_CODE } = {}) {
  if (!hasAdminCodeConfigured(adminCode)) {
    return {
      builder: true,
      deploy: true,
    }
  }
  return {
    builder: rank >= Ranks.BUILDER,
    deploy: rank >= Ranks.ADMIN,
  }
}

export async function resolveCliAuthStatus({
  authToken,
  db,
  worldId,
  adminCode = process.env.ADMIN_CODE,
} = {}) {
  const token = normalizeString(authToken)
  if (!token) {
    return {
      authenticated: false,
      error: 'auth_required',
    }
  }

  const claims = await readJWT(token, { worldId })
  const userId = normalizeString(claims?.userId)
  if (!userId) {
    return {
      authenticated: false,
      error: 'invalid_token',
    }
  }
  if (!db) {
    return {
      authenticated: false,
      error: 'db_unavailable',
    }
  }

  const user = await db('users').where('id', userId).first('id', 'name', 'rank')
  if (!user?.id) {
    return {
      authenticated: false,
      error: 'user_not_found',
    }
  }

  const rank = parseUserRank(user.rank)
  return {
    authenticated: true,
    worldId: normalizeString(worldId) || null,
    hasAdminCode: hasAdminCodeConfigured(adminCode),
    capabilities: buildCapabilities(rank, { adminCode }),
    user: {
      id: user.id,
      name: hasValue(user.name) ? user.name.trim() : 'Anonymous',
      rank,
    },
  }
}

export async function createStandaloneGuestSession({
  db,
  worldId,
} = {}) {
  if (!db) {
    throw new Error('db_unavailable')
  }
  if (!hasValue(worldId)) {
    throw new Error('world_id_missing')
  }

  const now = new Date().toISOString()
  const user = {
    id: uuid(),
    name: 'Anonymous',
    avatar: null,
    rank: Ranks.VISITOR,
    createdAt: now,
  }
  await db('users').insert(user)
  const token = await createJWT({ userId: user.id, worldId })
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      rank: user.rank,
    },
  }
}

export function buildCliAuthPage({
  callbackUrl,
  state,
  worldId,
  requiredCapability = 'builder',
  publicAuthUrl = null,
} = {}) {
  const config = JSON.stringify({
    callbackUrl: normalizeString(callbackUrl),
    state: normalizeString(state),
    worldId: normalizeString(worldId),
    requiredCapability: normalizeString(requiredCapability) || 'builder',
    publicAuthUrl: hasValue(publicAuthUrl) ? publicAuthUrl.trim() : null,
  }).replace(/</g, '\\u003c')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>World Auth</title>
    <style>
      :root {
        color-scheme: dark;
        --bg-panel: rgba(48, 50, 60, 0.25);
        --bg-section: rgba(48, 50, 60, 0.22);
        --bg-input: rgba(28, 30, 40, 0.55);
        --bg-hover: rgba(255, 255, 255, 0.04);
        --bg-subtle: rgba(255, 255, 255, 0.03);
        --border: rgba(255, 255, 255, 0.06);
        --border-light: rgba(255, 255, 255, 0.03);
        --border-hover: rgba(255, 255, 255, 0.12);
        --text-strong: rgba(255, 255, 255, 0.95);
        --text: rgba(255, 255, 255, 0.78);
        --text-soft: rgba(255, 255, 255, 0.56);
        --text-muted: rgba(255, 255, 255, 0.38);
        --success-line: rgba(102, 240, 150, 0.35);
        --success-bg: rgba(49, 122, 74, 0.2);
        --success-text: rgba(164, 255, 194, 0.95);
        --error-line: rgba(255, 110, 110, 0.35);
        --error-bg: rgba(122, 49, 49, 0.2);
        --error-text: rgba(255, 180, 180, 0.95);
        --warn-line: rgba(255, 195, 96, 0.28);
        --warn-bg: rgba(110, 76, 27, 0.22);
        --warn-text: rgba(255, 223, 156, 0.96);
        --hero-line: rgba(255, 255, 255, 0.06);
      }
      * {
        box-sizing: border-box;
      }
      html {
        height: 100%;
      }
      body {
        margin: 0;
        min-height: 100%;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top, rgba(255, 255, 255, 0.06), transparent 34%),
          radial-gradient(circle at bottom left, rgba(88, 116, 168, 0.12), transparent 28%),
          linear-gradient(180deg, rgba(11, 13, 20, 0.98) 0%, rgba(7, 9, 14, 1) 100%);
      }
      body::before {
        content: '';
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.56);
        backdrop-filter: blur(15px);
        pointer-events: none;
      }
      .authpage {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        position: relative;
      }
      .authpage-panel {
        position: relative;
        z-index: 1;
        width: 28rem;
        max-width: calc(100% - 2rem);
        max-height: calc(100vh - 2rem);
        display: flex;
        flex-direction: column;
        background: var(--bg-panel);
        border: 1px solid var(--border);
        overflow: hidden;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
      }
      .authpage-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }
      .authpage-hero {
        padding: 1.15rem 1rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        background: linear-gradient(180deg, rgba(44, 48, 58, 0.55) 0%, rgba(28, 30, 40, 0.55) 100%);
        border-bottom: 1px solid var(--hero-line);
      }
      .authpage-section-label {
        font-size: 0.68rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.35);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .authpage-hero-title {
        margin: 0;
        font-size: 1.15rem;
        line-height: 1.2;
        font-weight: 700;
        color: var(--text-strong);
      }
      .authpage-status {
        margin-top: 0.15rem;
        min-height: 4.4rem;
        padding: 0.85rem 0.95rem;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.04);
        white-space: pre-line;
        font-size: 0.88rem;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.84);
      }
      .authpage-status--busy {
        border-color: rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.9);
      }
      .authpage-status--success {
        border-color: var(--success-line);
        background: var(--success-bg);
        color: var(--success-text);
      }
      .authpage-status--warn {
        border-color: var(--warn-line);
        background: var(--warn-bg);
        color: var(--warn-text);
      }
      .authpage-status--error {
        border-color: var(--error-line);
        background: var(--error-bg);
        color: var(--error-text);
      }
      .authpage-section {
        padding: 0.9rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        border-bottom: 1px solid var(--border-light);
      }
      .authpage-rows {
        display: flex;
        flex-direction: column;
      }
      .authpage-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.7rem;
        padding: 0.46rem 0;
      }
      .authpage-label {
        font-size: 0.82rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.74);
      }
      .authpage-value {
        font-size: 0.8rem;
        text-align: right;
        color: var(--text-soft);
      }
      .authpage-feedback {
        margin: 0.9rem 1rem 0;
        padding: 0.55rem 0.65rem;
        border: 1px solid var(--border);
        background: var(--bg-subtle);
        font-size: 0.8rem;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.68);
      }
      .authpage-feedback--success {
        border-color: var(--success-line);
        background: var(--success-bg);
        color: var(--success-text);
      }
      .authpage-feedback--warn {
        border-color: var(--warn-line);
        background: var(--warn-bg);
        color: var(--warn-text);
      }
      .authpage-feedback--error {
        border-color: var(--error-line);
        background: var(--error-bg);
        color: var(--error-text);
      }
      .authpage-footer {
        padding: 0.85rem 1rem 1rem;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 0.75rem;
        border-top: 1px solid var(--border-light);
        flex-shrink: 0;
      }
      .authpage-footer-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.5rem;
      }
      .authpage-btn,
      .authpage-btn-enter {
        appearance: none;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 2.25rem;
        padding: 0 0.95rem;
        font: inherit;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        border: 1px solid var(--border);
      }
      .authpage-btn {
        color: rgba(255, 255, 255, 0.8);
        background: transparent;
      }
      .authpage-btn:hover {
        background: var(--bg-hover);
        color: var(--text-strong);
      }
      .authpage-btn-enter {
        color: rgba(255, 255, 255, 0.95);
        border-color: rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.08);
      }
      .authpage-btn-enter:hover {
        background: rgba(255, 255, 255, 0.13);
        border-color: rgba(255, 255, 255, 0.25);
        color: var(--text-strong);
      }
      @media (max-width: 640px) {
        .authpage {
          padding: 0.5rem;
        }
        .authpage-panel {
          width: 100%;
          max-width: 100%;
          max-height: calc(100vh - 1rem);
        }
        .authpage-footer,
        .authpage-footer-actions {
          width: 100%;
        }
        .authpage-btn,
        .authpage-btn-enter {
          flex: 1;
        }
      }
    </style>
  </head>
  <body>
    <div class="authpage">
      <main class="authpage-panel">
        <div class="authpage-scroll">
          <section class="authpage-hero">
            <div class="authpage-section-label">Authorize</div>
            <h1 class="authpage-hero-title">Authorize CLI Access</h1>
            <div class="authpage-feedback" id="subtitle">Waiting for world session...</div>
            <div class="authpage-status authpage-status--busy" id="status">Initializing...</div>
          </section>
          <section class="authpage-section">
            <div class="authpage-section-label">Session</div>
            <div class="authpage-rows">
              <div class="authpage-row">
                <span class="authpage-label">Required</span>
                <span class="authpage-value" id="required"></span>
              </div>
              <div class="authpage-row">
                <span class="authpage-label">Current User</span>
                <span class="authpage-value" id="user">Unknown</span>
              </div>
              <div class="authpage-row">
                <span class="authpage-label">World Access</span>
                <span class="authpage-value" id="capabilities">Checking...</span>
              </div>
            </div>
          </section>
          <div class="authpage-feedback" id="hint">
            Keep this tab open while you sign in or escalate your account in the world.
          </div>
        </div>
        <footer class="authpage-footer">
          <div class="authpage-footer-actions">
            <button class="authpage-btn" id="retry" type="button">Retry</button>
            <a class="authpage-btn-enter" id="openWorld" href="#" target="_blank" rel="noreferrer">Open World</a>
          </div>
        </footer>
      </main>
    </div>
    <script>
      const config = ${config}
      const statusEl = document.getElementById('status')
      const subtitleEl = document.getElementById('subtitle')
      const userEl = document.getElementById('user')
      const capabilitiesEl = document.getElementById('capabilities')
      const requiredEl = document.getElementById('required')
      const hintEl = document.getElementById('hint')
      const retryButton = document.getElementById('retry')
      const openWorldLink = document.getElementById('openWorld')
      const authStorageKey = 'authToken'
      let polling = null
      let busy = false

      function trimSlash(value) {
        return String(value || '').replace(/\\/+$/, '')
      }

      function worldBasePath() {
        const pathname = window.location.pathname || '/'
        const next = pathname.replace(/\\/auth\\/cli\\/?$/, '') || '/'
        return next === '/' ? '' : next.replace(/\\/+$/, '')
      }

      function worldRootUrl() {
        const basePath = worldBasePath()
        return basePath ? \`\${window.location.origin}\${basePath}\` : window.location.origin
      }

      function apiBaseUrl() {
        return \`\${trimSlash(worldRootUrl())}/api\`
      }

      function authBaseUrl() {
        return config.publicAuthUrl ? trimSlash(config.publicAuthUrl) : ''
      }

      function setStatus(message, subtitle, tone = 'busy') {
        statusEl.textContent = message
        subtitleEl.textContent = subtitle
        statusEl.className = \`authpage-status authpage-status--\${tone}\`
      }

      function setHint(message, tone = 'neutral') {
        hintEl.textContent = message
        hintEl.className = tone === 'neutral'
          ? 'authpage-feedback'
          : \`authpage-feedback authpage-feedback--\${tone}\`
      }

      function setUser(user) {
        if (user && user.name) {
          userEl.textContent = user.name
          return
        }
        userEl.textContent = 'Unknown'
      }

      function setCapabilities(value) {
        capabilitiesEl.textContent = value
      }

      function readStoredToken() {
        try {
          const raw = localStorage.getItem(authStorageKey)
          const parsed = raw ? JSON.parse(raw) : null
          return typeof parsed === 'string' ? parsed.trim() : ''
        } catch {
          return ''
        }
      }

      function storeToken(token) {
        if (!token) return
        localStorage.setItem(authStorageKey, JSON.stringify(token))
      }

      function clearToken() {
        localStorage.removeItem(authStorageKey)
      }

      function hasRequiredCapability(capabilities) {
        if (config.requiredCapability === 'deploy') return !!capabilities?.deploy
        if (config.requiredCapability === 'auth') return true
        return !!capabilities?.builder
      }

      function validateCallbackUrl(value) {
        try {
          const parsed = new URL(value)
          const hostname = parsed.hostname
          if (!hostname) return null
          if (hostname !== '127.0.0.1' && hostname !== 'localhost' && hostname !== '::1') return null
          return parsed.toString()
        } catch {
          return null
        }
      }

      async function fetchStatus(token) {
        const response = await fetch(\`\${apiBaseUrl()}/auth/cli/status\`, {
          headers: {
            authorization: \`Bearer \${token}\`,
            accept: 'application/json',
          },
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          return null
        }
        return data
      }

      async function tryExchangeIdentitySession() {
        if (!authBaseUrl()) return ''
        const identityResponse = await fetch(\`\${authBaseUrl()}/exchange\`, {
          method: 'POST',
          credentials: 'include',
        }).catch(() => null)
        if (!identityResponse || !identityResponse.ok) return ''
        const identityData = await identityResponse.json().catch(() => null)
        const identityToken = typeof identityData?.token === 'string' ? identityData.token.trim() : ''
        if (!identityToken) return ''

        const runtimeResponse = await fetch(\`\${apiBaseUrl()}/auth/exchange\`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({ token: identityToken }),
        }).catch(() => null)
        if (!runtimeResponse || !runtimeResponse.ok) return ''
        const runtimeData = await runtimeResponse.json().catch(() => null)
        const runtimeToken = typeof runtimeData?.token === 'string' ? runtimeData.token.trim() : ''
        if (!runtimeToken) return ''
        storeToken(runtimeToken)
        return runtimeToken
      }

      async function bootstrapStandaloneGuest() {
        if (authBaseUrl()) return ''
        const response = await fetch(\`\${apiBaseUrl()}/auth/cli/guest\`, {
          method: 'POST',
          headers: {
            accept: 'application/json',
          },
        }).catch(() => null)
        if (!response || !response.ok) return ''
        const data = await response.json().catch(() => null)
        const token = typeof data?.token === 'string' ? data.token.trim() : ''
        if (!token) return ''
        storeToken(token)
        return token
      }

      async function submitToken(token, status) {
        const callbackUrl = validateCallbackUrl(config.callbackUrl)
        if (!callbackUrl) {
          throw new Error('Invalid callback URL')
        }
        const response = await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            state: config.state,
            worldId: status?.worldId || config.worldId || '',
            worldUrl: worldRootUrl(),
            authToken: token,
            user: status?.user || null,
            capabilities: status?.capabilities || null,
          }),
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error || 'callback_failed')
        }
      }

      function describeCapabilities(capabilities) {
        if (!capabilities) return 'Not authenticated'
        if (capabilities.deploy) return 'Admin / deploy'
        if (capabilities.builder) return 'Builder'
        return 'Authenticated, no builder access'
      }

      async function runCheck() {
        if (busy) return
        busy = true
        try {
          setStatus('Checking current browser session...', 'Using this world origin to authorize the CLI.', 'busy')
          setHint('Keep this tab open while the CLI verifies this browser session.')

          let token = readStoredToken()
          let status = token ? await fetchStatus(token) : null

          if (!status) {
            clearToken()
            token = await tryExchangeIdentitySession()
            status = token ? await fetchStatus(token) : null
          }

          if (!status) {
            token = await bootstrapStandaloneGuest()
            status = token ? await fetchStatus(token) : null
          }

          setUser(status?.user || null)
          setCapabilities(describeCapabilities(status?.capabilities))

          if (token && status?.authenticated && hasRequiredCapability(status.capabilities)) {
            setStatus(
              'CLI access granted. Returning to the terminal...',
              'You can close this tab if it does not close automatically.',
              'success'
            )
            setHint('Permission confirmed. The CLI is storing this world token locally.', 'success')
            await submitToken(token, status)
            clearInterval(polling)
            setTimeout(() => {
              window.close()
            }, 250)
            return
          }

          const needsLogin = !!authBaseUrl()
          openWorldLink.href = worldRootUrl()

          if (!token || !status?.authenticated) {
            setStatus(
              needsLogin
                ? 'Open the world in this browser and finish signing in. This page will detect the new session automatically.'
                : 'Open the world in this browser to continue. This page will reuse the same local world session automatically.',
              'Waiting for a browser world session...',
              'busy'
            )
            setHint(needsLogin
              ? 'After you sign in inside the world, this tab will continue automatically.'
              : 'For local worlds, this browser session becomes the identity that /admin can elevate.')
            return
          }

          setStatus(
            'This browser is authenticated, but it does not have enough permission for the requested CLI operation yet.',
            'Grant the account access in-world, then this page will continue automatically.',
            'warn'
          )
          setHint(authBaseUrl()
            ? 'If you need full deploy access, make sure this account is an admin for the world.'
            : 'For standalone worlds, open the world in this browser and run /admin <code> on the same account.',
            'warn')
        } catch (error) {
          setStatus(
            'Authentication check failed. Retry, or open the world manually in this browser and come back.',
            error instanceof Error ? error.message : 'Unexpected error',
            'error'
          )
          setHint('If the problem persists, reopen the world in this browser and retry the flow.', 'error')
        } finally {
          busy = false
        }
      }

      requiredEl.textContent = config.requiredCapability === 'deploy'
        ? 'Deploy access'
        : config.requiredCapability === 'auth'
          ? 'Authenticated world session'
          : 'Builder access'
      openWorldLink.href = worldRootUrl()
      retryButton.addEventListener('click', () => {
        void runCheck()
      })
      polling = setInterval(() => {
        void runCheck()
      }, 2000)
      void runCheck()
    </script>
  </body>
</html>`
}

export function getCliAuthTokenFromRequest(req) {
  return getAuthTokenFromAuthorizationHeader(req?.headers?.authorization)
}
