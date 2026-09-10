import { createPublicClient, createWalletClient, custom, defineChain, getAddress } from 'viem'

const SESSION_CACHE_TTL_MS = 3000
const DEFAULT_REFRESH_INTERVAL_MS = 3000

function getRuntimeAuthBridge() {
  if (typeof globalThis === 'undefined') return null
  return globalThis.__runtimeAuth || null
}

function getRuntimeWalletBridge() {
  if (typeof globalThis === 'undefined') return null
  return globalThis.__runtimeWalletBridge || null
}

function getInjectedProvider() {
  if (typeof window === 'undefined') return null
  const provider = window.ethereum
  if (!provider || typeof provider.request !== 'function') return null
  return provider
}

function normalizeAddress(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return ''
  try {
    return getAddress(trimmed)
  } catch {
    return ''
  }
}

function sameAddress(a, b) {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}

function toHexChainId(chainId) {
  if (typeof chainId === 'number' && Number.isInteger(chainId) && chainId > 0) {
    return `0x${chainId.toString(16)}`
  }
  if (typeof chainId === 'string') {
    const trimmed = chainId.trim()
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) return trimmed
    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isInteger(parsed) && parsed > 0) {
      return `0x${parsed.toString(16)}`
    }
  }
  throw new Error(`Invalid chain id: ${chainId}`)
}

function parseChainId(chainId) {
  if (typeof chainId === 'number' && Number.isInteger(chainId) && chainId > 0) {
    return chainId
  }
  if (typeof chainId === 'string') {
    const trimmed = chainId.trim()
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
      const parsedHex = Number.parseInt(trimmed, 16)
      return Number.isInteger(parsedHex) && parsedHex > 0 ? parsedHex : null
    }
    const parsedDec = Number.parseInt(trimmed, 10)
    return Number.isInteger(parsedDec) && parsedDec > 0 ? parsedDec : null
  }
  return null
}

async function readProviderChainId(provider) {
  if (!provider || typeof provider.request !== 'function') return null
  const chainId = await provider.request({ method: 'eth_chainId' }).catch(() => null)
  return parseChainId(chainId)
}

function defineProviderChain(chainId) {
  if (!Number.isInteger(chainId) || chainId <= 0) return null
  return defineChain({
    id: chainId,
    name: `EVM Chain ${chainId}`,
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [],
      },
    },
  })
}

async function getInjectedAccounts({ request = false } = {}) {
  const provider = getInjectedProvider()
  if (!provider) return []

  const method = request ? 'eth_requestAccounts' : 'eth_accounts'
  const accounts = await provider
    .request({ method })
    .then(value => (Array.isArray(value) ? value : []))
    .catch(err => {
      if (!request) return []
      if (err?.code === 4001) throw err
      return []
    })

  return accounts.map(account => normalizeAddress(account)).filter(Boolean)
}

function toSignTypedDataPayload({ domain, types, primaryType, message }) {
  const payload = { domain, types, primaryType, message }
  return JSON.stringify(payload, (_key, value) => {
    if (typeof value === 'bigint') return value.toString()
    return value
  })
}

function isEmbeddedPrivyEvmWallet(wallet) {
  if (wallet?.type !== 'ethereum') return false
  if (!normalizeAddress(wallet.address)) return false

  const connectorType = typeof wallet?.connectorType === 'string' ? wallet.connectorType.toLowerCase() : ''
  const walletClientType = typeof wallet?.walletClientType === 'string' ? wallet.walletClientType.toLowerCase() : ''

  if (connectorType === 'embedded') return true
  return walletClientType === 'privy' || walletClientType === 'privy-v2'
}

function normalizePrivyWallets(snapshot) {
  const wallets = Array.isArray(snapshot?.wallets) ? snapshot.wallets : []
  return wallets.filter(isEmbeddedPrivyEvmWallet)
}

function normalizeSessionWalletBinding(session) {
  const wallet = session?.user?.wallet
  if (wallet && typeof wallet === 'object') {
    if (wallet.type === 'ethereum') {
      const address = normalizeAddress(wallet.address)
      if (address) {
        return {
          type: 'ethereum',
          address,
        }
      }
    }

    if (wallet.type === 'solana' && typeof wallet.address === 'string' && wallet.address.trim()) {
      return {
        type: 'solana',
        address: wallet.address.trim(),
      }
    }
  }

  const legacyAddress = normalizeAddress(session?.user?.wallet_address || '')
  if (!legacyAddress) {
    return {
      type: '',
      address: '',
    }
  }

  return {
    type: 'ethereum',
    address: legacyAddress,
  }
}

export class RuntimeWalletAdapter {
  constructor({
    authBridge = getRuntimeAuthBridge(),
    walletBridge = getRuntimeWalletBridge(),
    refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
  } = {}) {
    this.authBridge = authBridge
    this.walletBridge = walletBridge
    this.refreshIntervalMs = refreshIntervalMs

    this.snapshot = {
      source: null,
      address: null,
      connected: false,
      chainId: null,
    }

    this.sessionWallet = {
      type: '',
      address: '',
    }
    this.sessionWalletFetchedAt = 0
    this.listeners = new Set()
    this.disconnected = false
    this.refreshVersion = 0

    this.unsubscribeWalletBridge = null
    this.unsubscribeAccount = null
    this.refreshTimer = null
    this.injectedSubscriptions = []

    this._bindLifecycle()
    void this.refresh()
  }

  _bindLifecycle() {
    this._bindInjectedEvents()
    if (this.walletBridge && typeof this.walletBridge.subscribe === 'function') {
      this.unsubscribeWalletBridge = this.walletBridge.subscribe(() => {
        void this.refresh()
      })
    }

    if (this.authBridge && typeof this.authBridge.subscribeAccountChanges === 'function') {
      this.unsubscribeAccount = this.authBridge.subscribeAccountChanges(() => {
        void this.refresh()
      })
    }

    if (this.refreshIntervalMs > 0) {
      this.refreshTimer = setInterval(() => {
        void this.refresh()
      }, this.refreshIntervalMs)
    }
  }

  destroy() {
    for (const remove of this.injectedSubscriptions) remove()
    this.injectedSubscriptions = []
    this.unsubscribeWalletBridge?.()
    this.unsubscribeAccount?.()
    this.unsubscribeWalletBridge = null
    this.unsubscribeAccount = null
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
    this.listeners.clear()
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {}
    }
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  _emitChange() {
    const value = this.getSnapshot()
    for (const listener of this.listeners) {
      listener(value)
    }
  }

  _updateSnapshot(nextSnapshot) {
    const changed =
      this.snapshot.source !== nextSnapshot.source ||
      this.snapshot.address !== nextSnapshot.address ||
      this.snapshot.connected !== nextSnapshot.connected ||
      this.snapshot.chainId !== nextSnapshot.chainId
    if (!changed) return
    this.snapshot = nextSnapshot
    this._emitChange()
  }

  getSnapshot() {
    return { ...this.snapshot }
  }

  getAddress() {
    return this.snapshot.address
  }

  isConnected() {
    return this.snapshot.connected
  }

  _allowsUnscopedWalletAccess() {
    return this.authBridge?.allowsUnscopedWalletAccess?.() ?? true
  }

  async _getSessionWalletBinding({ force = false } = {}) {
    const now = Date.now()
    if (!force && now - this.sessionWalletFetchedAt < SESSION_CACHE_TTL_MS) {
      return this.sessionWallet
    }

    let session = null
    if (typeof this.authBridge?.getSessionUser === 'function') {
      session = await this.authBridge.getSessionUser().catch(() => null)
    }
    this.sessionWallet = normalizeSessionWalletBinding(session)
    this.sessionWalletFetchedAt = now
    return this.sessionWallet
  }

  _getPrivyWallets() {
    const snapshot = this.walletBridge?.getSnapshot?.() || null
    return normalizePrivyWallets(snapshot)
  }

  async _createPrivyContext(wallet) {
    if (!wallet || typeof wallet.getEthereumProvider !== 'function') return null
    const address = normalizeAddress(wallet.address)
    if (!address) return null
    const provider = await wallet.getEthereumProvider().catch(() => null)
    if (!provider || typeof provider.request !== 'function') return null
    return {
      source: 'privy',
      address,
      provider,
      wallet,
    }
  }

  async _resolveInjectedContext({ expectedAddress = '', request = false } = {}) {
    const provider = getInjectedProvider()
    if (!provider) return null

    const accounts = await getInjectedAccounts({ request })
    if (!accounts.length) return null

    if (expectedAddress) {
      const matched = accounts.find(address => sameAddress(address, expectedAddress))
      if (!matched) return null
      return {
        source: 'injected',
        address: matched,
        provider,
        wallet: null,
      }
    }

    return {
      source: 'injected',
      address: accounts[0],
      provider,
      wallet: null,
    }
  }

  async _resolveWalletContext({ request = false } = {}) {
    if (this.disconnected) return null
    const sessionWallet = await this._getSessionWalletBinding()
    if (sessionWallet?.type === 'solana') {
      return null
    }
    const sessionAddress = sessionWallet?.type === 'ethereum' ? sessionWallet.address : ''
    const privyWallets = this._getPrivyWallets()

    if (sessionAddress) {
      for (const wallet of privyWallets) {
        if (!sameAddress(normalizeAddress(wallet.address), sessionAddress)) continue
        const context = await this._createPrivyContext(wallet)
        if (context) return context
      }
    }

    if (!sessionAddress && !this._allowsUnscopedWalletAccess()) {
      return null
    }

    for (const wallet of privyWallets) {
      const context = await this._createPrivyContext(wallet)
      if (context) return context
    }

    if (sessionAddress) {
      const injectedSession = await this._resolveInjectedContext({
        expectedAddress: sessionAddress,
        request,
      })
      if (injectedSession) return injectedSession
    }

    return this._resolveInjectedContext({ request })
  }

  async _requireWalletContext({ request = true } = {}) {
    const context = await this._resolveWalletContext({ request })
    if (!context) {
      throw new Error('Wallet not connected')
    }
    return context
  }

  async refresh() {
    const version = ++this.refreshVersion
    const context = await this._resolveWalletContext({ request: false }).catch(() => null)
    if (version !== this.refreshVersion) return this.getSnapshot()
    if (!context) {
      this._updateSnapshot({
        source: null,
        address: null,
        connected: false,
        chainId: null,
      })
      return this.getSnapshot()
    }

    const chainId = await readProviderChainId(context.provider)
    if (version !== this.refreshVersion) return this.getSnapshot()
    this._updateSnapshot({
      source: context.source,
      address: context.address,
      connected: true,
      chainId,
    })
    return this.getSnapshot()
  }

  async connect() {
    this.disconnected = false
    this._bindInjectedEvents()
    await this._requireWalletContext({ request: true })
    return this.refresh()
  }

  disconnect() {
    this.disconnected = true
    this.refreshVersion++
    this._updateSnapshot({ source: null, address: null, connected: false, chainId: null })
  }

  _bindInjectedEvents() {
    for (const remove of this.injectedSubscriptions) remove()
    this.injectedSubscriptions = []
    const provider = getInjectedProvider()
    if (!provider?.on) return
    for (const event of ['accountsChanged', 'chainChanged', 'disconnect']) {
      const handler = () => {
        // Invalidate first; a provider read must establish the new binding.
        this.refreshVersion++
        this._updateSnapshot({ source: null, address: null, connected: false, chainId: null })
        if (event !== 'disconnect') void this.refresh()
      }
      provider.on(event, handler)
      this.injectedSubscriptions.push(() => provider.removeListener?.(event, handler))
    }
  }

  async getChainId({ request = false } = {}) {
    const context = await this._requireWalletContext({ request })
    return readProviderChainId(context.provider)
  }

  async switchChain(input) {
    const requestedChainId = typeof input === 'object' && input !== null ? input.chainId : input
    const targetChainHex = toHexChainId(requestedChainId)
    const context = await this._requireWalletContext({ request: true })

    if (context.source === 'privy' && typeof context.wallet?.switchChain === 'function') {
      const maybeNumber = parseChainId(targetChainHex)
      await context.wallet.switchChain(maybeNumber || targetChainHex)
    } else {
      const switchRequest = { method: 'wallet_switchEthereumChain', params: [{ chainId: targetChainHex }] }
      try {
        await context.provider.request(switchRequest)
      } catch (error) {
        if (error?.code !== 4902 || !input?.chain) throw error
        const chain = input.chain
        if (chain.id !== parseChainId(targetChainHex)) throw new Error('Chain metadata does not match requested chain')
        await context.provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: targetChainHex,
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: chain.rpcUrls.default.http,
            },
          ],
        })
        await context.provider.request(switchRequest)
      }
    }

    if ((await readProviderChainId(context.provider)) !== parseChainId(targetChainHex)) {
      throw new Error('Wallet did not switch to the requested chain')
    }
    await this.refresh()
    return { id: parseChainId(targetChainHex) }
  }

  async signTypedData({ domain, types, primaryType, message }) {
    const context = await this._requireWalletContext({ request: true })
    const payload = toSignTypedDataPayload({ domain, types, primaryType, message })

    try {
      return await context.provider.request({
        method: 'eth_signTypedData_v4',
        params: [context.address, payload],
      })
    } catch (firstError) {
      try {
        return await context.provider.request({
          method: 'eth_signTypedData',
          params: [context.address, payload],
        })
      } catch {
        throw firstError
      }
    }
  }

  async _getViemClients({ request = true } = {}) {
    const context = await this._requireWalletContext({ request })
    const chainId = await readProviderChainId(context.provider)
    const chain = defineProviderChain(chainId)
    if (!chain) {
      throw new Error('Unable to determine active chain for wallet provider')
    }
    const transport = custom(context.provider)

    const publicClient = createPublicClient({ chain, transport })
    const walletClient = createWalletClient({ chain, transport, account: context.address })

    return {
      context,
      publicClient,
      walletClient,
    }
  }

  async readContract(params) {
    const { publicClient } = await this._getViemClients({ request: true })
    return publicClient.readContract(params)
  }

  async getBalance({ address, request = false } = {}) {
    const { context, publicClient } = await this._getViemClients({ request })
    const resolvedAddress = normalizeAddress(address || context.address)
    if (!resolvedAddress) {
      throw new Error('Invalid address')
    }
    return publicClient.getBalance({ address: resolvedAddress })
  }

  async signMessage(params) {
    const { context, walletClient } = await this._getViemClients({ request: true })
    if (params?.account && !sameAddress(params.account, context.address)) throw new Error('Wallet account changed')
    return walletClient.signMessage({ ...params, account: context.address })
  }

  async sendTransaction(params) {
    const { context, walletClient } = await this._getViemClients({ request: true })
    return walletClient.sendTransaction({
      ...params,
      account: params?.account || context.address,
    })
  }

  async writeContract(params) {
    const { context, walletClient } = await this._getViemClients({ request: true })
    const expectedAccount = typeof params?.account === 'string' ? params.account : params?.account?.address
    if (expectedAccount && !sameAddress(expectedAccount, context.address)) throw new Error('Wallet account changed')
    if (params?.chain?.id && (await readProviderChainId(context.provider)) !== params.chain.id) {
      throw new Error('Wallet chain changed')
    }
    return walletClient.writeContract({
      ...params,
      account: params?.account || context.address,
    })
  }

  async waitForTransactionReceipt(params) {
    const { publicClient } = await this._getViemClients({ request: false })
    return publicClient.waitForTransactionReceipt(params)
  }
}

export function createRuntimeWalletAdapter(options) {
  return new RuntimeWalletAdapter(options)
}
