const GUEST_CHOICE = 'identity-continue-as-guest'
const PENDING_SIGN_OUT = 'identity-sign-out-pending'
const normalize = value => (typeof value === 'string' ? value.toLowerCase() : '')

export function createIdentityAuthBridge(
  baseUrl,
  walletBridge,
  {
    fetcher = fetch,
    provider = () => globalThis.ethereum,
    storage = globalThis.localStorage,
    reload = () => globalThis.location.reload(),
  } = {}
) {
  let initialized
  let login
  let loginController
  let selectingWallet = false
  let reconnecting = false
  let observedAddress = ''
  let tracking = false
  let connectionIdentity
  let connectionKnown = false
  let trackedProvider
  const transitionListeners = new Set()
  const read = key => {
    try {
      return storage?.getItem(key)
    } catch {
      return null
    }
  }
  const write = (key, value) => {
    try {
      if (value === null) storage?.removeItem(key)
      else storage?.setItem(key, value)
    } catch {}
  }
  function transition() {
    if (reconnecting) return false
    reconnecting = true
    walletBridge.clearRuntimeAuthState?.()
    for (const listener of transitionListeners) listener()
    return true
  }
  function rejoin() {
    if (transition()) reload()
  }
  async function request(path, body, signal) {
    const response = await fetcher(`${baseUrl}/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      signal: signal || AbortSignal.timeout(8000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const data = await response.json()
    if (!response.ok) {
      const error = new Error(data.error || 'Unable to sign in')
      error.status = response.status
      throw error
    }
    return data
  }
  async function readSession() {
    try {
      return await request('me')
    } catch (error) {
      if (error.status === 401) return null
      throw error
    }
  }
  async function invalidateAndReload() {
    if (!transition()) return
    write(PENDING_SIGN_OUT, '1')
    write(GUEST_CHOICE, null)
    loginController?.abort()
    try {
      await request('logout', {})
      write(PENDING_SIGN_OUT, null)
    } catch {
      /* Retry logout before reconnecting after the reload. */
    } finally {
      reload()
    }
  }
  const accountChanged = accounts => {
    const next = normalize(accounts?.[0])
    if (!tracking || selectingWallet) {
      observedAddress = next
      return
    }
    if (next === observedAddress) return
    observedAddress = next
    void invalidateAndReload()
  }
  const disconnected = () => accountChanged([])
  async function initialize() {
    if (initialized) return initialized
    initialized = (async () => {
      // A failed logout must never restore the previous wallet's session.
      if (read(PENDING_SIGN_OUT)) {
        await request('logout', {})
        write(PENDING_SIGN_OUT, null)
      }
      trackedProvider?.removeListener?.('accountsChanged', accountChanged)
      trackedProvider?.removeListener?.('disconnect', disconnected)
      trackedProvider = provider()
      trackedProvider?.on?.('accountsChanged', accountChanged)
      trackedProvider?.on?.('disconnect', disconnected)
      const session = await readSession()
      const accounts = await trackedProvider?.request?.({ method: 'eth_accounts' }).catch(() => [])
      observedAddress = normalize(accounts?.[0])
      tracking = true
      if (session?.user?.wallet?.address && normalize(session.user.wallet.address) !== observedAddress) {
        await invalidateAndReload()
        throw Object.assign(new Error('Wallet changed. Rejoining as guest.'), { skipAuth: true })
      }
      return session
    })().catch(error => {
      initialized = null
      throw error
    })
    return initialized
  }
  async function performLogin() {
    await initialize()
    if (reconnecting) return null
    const wallet = provider()
    if (!wallet?.request) throw new Error('Open this page in a browser with an EVM wallet installed.')
    loginController = new AbortController()
    let address
    selectingWallet = true
    try {
      const accounts = await wallet.request({ method: 'eth_requestAccounts' })
      address = accounts?.[0]
      observedAddress = normalize(address)
    } finally {
      selectingWallet = false
    }
    if (!/^0x[0-9a-f]{40}$/i.test(address || '')) throw new Error('Select an EVM wallet account.')
    const chainId = Number(await wallet.request({ method: 'eth_chainId' }))
    const challenge = await request('challenge', { address, chainId }, loginController.signal)
    const message = `0x${Array.from(new TextEncoder().encode(challenge.message), byte => byte.toString(16).padStart(2, '0')).join('')}`
    const signature = await wallet.request({ method: 'personal_sign', params: [message, address] })
    const current = await wallet.request({ method: 'eth_accounts' })
    if (reconnecting || normalize(current?.[0]) !== normalize(address)) {
      await invalidateAndReload()
      throw Object.assign(new Error('Wallet changed. Sign in again.'), { skipAuth: true })
    }
    await request('verify', { signature }, loginController.signal)
    const session = await request('me', undefined, loginController.signal)
    write(GUEST_CHOICE, null)
    rejoin()
    return session
  }
  const bridge = {
    ...walletBridge,
    mode: 'identity',
    enabled: true,
    initialize,
    allowsUnscopedWalletAccess: () => false,
    isReconnecting: () => reconnecting,
    shouldOfferSignIn: () => !read(GUEST_CHOICE),
    continueAsGuest: () => write(GUEST_CHOICE, '1'),
    setConnectionIdentity(identity) {
      connectionIdentity = identity
      connectionKnown = true
    },
    onTransition(listener) {
      transitionListeners.add(listener)
      return () => transitionListeners.delete(listener)
    },
    async getSessionUser() {
      if (reconnecting || (connectionKnown && !connectionIdentity)) return null
      const session = await readSession().catch(() => null)
      return connectionKnown && connectionIdentity?.userId !== session?.user?.id ? null : session
    },
    connectWalletSession() {
      if (!login)
        login = performLogin().finally(() => {
          login = null
          loginController = null
        })
      return login
    },
    async ensureWalletSession() {
      await initialize()
      if (reconnecting) return false
      const session = await readSession()
      const accounts = await provider()
        ?.request?.({ method: 'eth_accounts' })
        .catch(() => [])
      if (session?.user?.id && normalize(session.user.wallet?.address) === normalize(accounts?.[0])) {
        if (connectionKnown && connectionIdentity?.userId === session.user.id) return true
        rejoin()
      } else {
        await bridge.connectWalletSession()
      }
      return false
    },
    async logoutAndClearSession() {
      write(PENDING_SIGN_OUT, '1')
      await request('logout', {})
      write(PENDING_SIGN_OUT, null)
      write(GUEST_CHOICE, null)
      walletBridge.clearRuntimeAuthState?.()
    },
    async updateProfile() {
      throw new Error('Manage your profile in your account settings.')
    },
    dispose() {
      trackedProvider?.removeListener?.('accountsChanged', accountChanged)
      trackedProvider?.removeListener?.('disconnect', disconnected)
      transitionListeners.clear()
    },
  }
  return bridge
}
