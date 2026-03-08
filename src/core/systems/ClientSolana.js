import { address as normalizeSolanaAddress, createSolanaRpc } from '@solana/kit'
import { TOKEN_PROGRAM_ADDRESS, fetchMaybeToken, fetchMint, findAssociatedTokenPda } from '@solana-program/token'

import { uuid } from '../utils'
import { System } from './System'

const SOL_DECIMALS = 9
const DEFAULT_SOLANA_RPC_URLS = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function toUint8Array(value) {
  if (!value) return null
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (Array.isArray(value)) return Uint8Array.from(value)
  if (typeof value?.serialize === 'function') {
    try {
      return toUint8Array(value.serialize())
    } catch {
      return null
    }
  }
  return null
}

function encodeBase64(bytes) {
  const normalized = toUint8Array(bytes)
  if (!normalized) return ''
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(normalized).toString('base64')
  }
  let binary = ''
  for (const byte of normalized) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function decodeBase64(value) {
  if (!isNonEmptyString(value)) return null
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'))
  }
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function createPendingOperation(kind, amount) {
  const requestId = uuid()
  let resolve
  let reject
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return {
    requestId,
    kind,
    amount,
    status: 'pending',
    lastEventKey: '',
    promise,
    resolve,
    reject,
  }
}

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function getRuntimeEnvString(name) {
  if (typeof globalThis !== 'undefined' && typeof globalThis?.env?.[name] === 'string') {
    return globalThis.env[name].trim()
  }
  if (typeof process !== 'undefined' && typeof process?.env?.[name] === 'string') {
    return process.env[name].trim()
  }
  return ''
}

function normalizeRpcHttpUrl(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return ''
  if (normalized.startsWith('https://') || normalized.startsWith('http://')) return normalized
  if (normalized.startsWith('wss://')) return `https://${normalized.slice('wss://'.length)}`
  if (normalized.startsWith('ws://')) return `http://${normalized.slice('ws://'.length)}`
  return normalized
}

export class ClientSolana extends System {
  constructor(world) {
    super(world)
    this.walletAdapter = null
    this.address = null
    this.connected = false
    this.cluster = 'mainnet'
    this.pendingOperations = new Map()
    this.rpcClients = new Map()
    this.mintAccountCache = new Map()
  }

  bind(binding = null) {
    const nextBinding = binding && typeof binding === 'object' ? binding : null
    this.walletAdapter = nextBinding
    this.address = isNonEmptyString(nextBinding?.address) ? nextBinding.address.trim() : null
    this.connected = typeof nextBinding?.connected === 'boolean' ? nextBinding.connected : false
    this.cluster = isNonEmptyString(nextBinding?.cluster) ? nextBinding.cluster.trim() : 'mainnet'
    this.emit('change', this.getSnapshot())
  }

  getSnapshot() {
    return {
      address: this.getAddress(),
      connected: this.isConnected(),
      cluster: this.cluster,
    }
  }

  getAddress() {
    if (this.address) return this.address
    if (typeof this.walletAdapter?.getAddress === 'function') {
      return this.walletAdapter.getAddress() || null
    }
    return null
  }

  isConnected() {
    if (this.connected) return true
    if (typeof this.walletAdapter?.isConnected === 'function') {
      return !!this.walletAdapter.isConnected()
    }
    return false
  }

  _requireWalletAdapter() {
    if (!this.walletAdapter) {
      throw new Error('Solana wallet not connected')
    }
    return this.walletAdapter
  }

  _normalizeAddress(value, fieldName = 'address') {
    if (!isNonEmptyString(value)) {
      throw new Error(`${fieldName} is required`)
    }
    try {
      return normalizeSolanaAddress(value.trim())
    } catch {
      throw new Error(`Invalid ${fieldName}`)
    }
  }

  _getRpcUrl(cluster = this.cluster) {
    const configuredUrl =
      getRuntimeEnvString('PUBLIC_SOLANA_RPC_URL') ||
      getRuntimeEnvString('PUBLIC_RPC_URL') ||
      getRuntimeEnvString('RPC_URL')
    return normalizeRpcHttpUrl(configuredUrl) || DEFAULT_SOLANA_RPC_URLS[cluster] || DEFAULT_SOLANA_RPC_URLS.mainnet
  }

  _getRpc(cluster = this.cluster) {
    const rpcUrl = this._getRpcUrl(cluster)
    let rpc = this.rpcClients.get(rpcUrl)
    if (!rpc) {
      rpc = createSolanaRpc(rpcUrl)
      this.rpcClients.set(rpcUrl, rpc)
    }
    return rpc
  }

  _getConfiguredWorldTokenMintAddress() {
    const configuredMint =
      getRuntimeEnvString('PUBLIC_WORLD_TOKEN_MINT_ADDRESS') ||
      getRuntimeEnvString('WORLD_TOKEN_MINT_ADDRESS')
    if (!configuredMint) return null
    try {
      return normalizeSolanaAddress(configuredMint)
    } catch {
      throw new Error('Invalid world token mint address')
    }
  }

  _formatAtomicUnits(amount, decimals) {
    if (typeof amount !== 'bigint') {
      throw new Error('Amount must be a bigint')
    }
    if (!Number.isInteger(decimals) || decimals < 0) {
      throw new Error('Invalid decimals')
    }
    const scale = 10n ** BigInt(decimals)
    const whole = amount / scale
    const remainder = amount % scale
    const fraction = remainder.toString().padStart(decimals, '0').replace(/0+$/, '')
    const normalized = fraction ? `${whole.toString()}.${fraction}` : whole.toString()
    const numericValue = Number(normalized)
    if (!Number.isFinite(numericValue)) {
      throw new Error('Amount exceeds supported number range')
    }
    return numericValue
  }

  async _fetchMintAccount(mintAddress) {
    const cacheKey = `${this._getRpcUrl(this.cluster)}:${mintAddress}`
    if (!this.mintAccountCache.has(cacheKey)) {
      this.mintAccountCache.set(cacheKey, fetchMint(this._getRpc(), mintAddress))
    }
    return this.mintAccountCache.get(cacheKey)
  }

  async _fetchNativeBalance(address) {
    const rpc = this._getRpc()
    const { value: lamports } = await rpc.getBalance(address).send()
    return BigInt(lamports)
  }

  async _fetchMaybeTokenAccount(tokenAddress) {
    return fetchMaybeToken(this._getRpc(), tokenAddress)
  }

  _assertLocalPlayer(player, action) {
    if (!player) return
    const playerId = player?.data?.id || player?.id
    if (!playerId) return
    if (playerId !== this.world.network.id) {
      throw new Error(`[solana] cannot ${action} a remote player from client`)
    }
  }

  _createPendingOperation(kind, amount) {
    const operation = createPendingOperation(kind, amount)
    this.pendingOperations.set(operation.requestId, operation)
    this._emitOperationEvent(operation, { status: 'pending' })
    return operation
  }

  _emitOperationEvent(operation, payload = {}) {
    if (!operation?.requestId) return
    const status = payload.status || operation.status || 'pending'
    const eventKey = `${status}:${payload.signature || ''}:${payload.error || ''}`
    if (operation.lastEventKey === eventKey) return
    operation.lastEventKey = eventKey
    operation.status = status
    this.emit('operation', {
      requestId: operation.requestId,
      kind: operation.kind,
      amount: operation.amount,
      status,
      signature: payload.signature || null,
      error: payload.error || null,
    })
  }

  _resolvePendingOperation(data) {
    const requestId = data?.requestId
    if (!requestId) return
    const operation = this.pendingOperations.get(requestId)
    if (!operation) return
    this.pendingOperations.delete(requestId)
    if (data?.error) {
      this._emitOperationEvent(operation, {
        status: 'failed',
        error: data.error,
      })
      operation.reject(new Error(data.error))
      return
    }
    this._emitOperationEvent(operation, {
      status: 'confirmed',
      signature: data?.signature || null,
    })
    operation.resolve(data)
  }

  async signMessageBytes(messageBytes) {
    const walletAdapter = this._requireWalletAdapter()
    if (typeof walletAdapter.signMessage !== 'function') {
      throw new Error('Solana wallet cannot sign messages')
    }
    const signature = await walletAdapter.signMessage(toUint8Array(messageBytes))
    const normalized = toUint8Array(signature?.signature || signature)
    if (!normalized) {
      throw new Error('Invalid Solana message signature')
    }
    return normalized
  }

  async signTransactionBytes(transactionBytes) {
    const walletAdapter = this._requireWalletAdapter()
    if (typeof walletAdapter.signTransaction !== 'function') {
      throw new Error('Solana wallet cannot sign transactions')
    }
    const signedTransaction = await walletAdapter.signTransaction(toUint8Array(transactionBytes))
    const normalized = toUint8Array(
      signedTransaction?.signedTransaction || signedTransaction?.transaction || signedTransaction
    )
    if (!normalized) {
      throw new Error('Invalid signed Solana transaction')
    }
    return normalized
  }

  async getNativeBalance(address = this.getAddress()) {
    const ownerAddress = this._normalizeAddress(address, 'address')
    const lamports = await this._fetchNativeBalance(ownerAddress)
    return this._formatAtomicUnits(lamports, SOL_DECIMALS)
  }

  async getTokenBalance(mintAddress = this._getConfiguredWorldTokenMintAddress(), address = this.getAddress()) {
    if (!mintAddress) {
      throw new Error('World token mint address not configured')
    }
    const ownerAddress = this._normalizeAddress(address, 'address')
    const normalizedMintAddress = this._normalizeAddress(mintAddress, 'mintAddress')
    const mintAccount = await this._fetchMintAccount(normalizedMintAddress)
    const [tokenAddress] = await findAssociatedTokenPda({
      owner: ownerAddress,
      mint: normalizedMintAddress,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    })
    const tokenAccount = await this._fetchMaybeTokenAccount(tokenAddress)
    if (!tokenAccount.exists) {
      return 0
    }
    return this._formatAtomicUnits(tokenAccount.data.amount, mintAccount.data.decimals)
  }

  async getWorldTokenBalance(address = this.getAddress()) {
    return this.getTokenBalance(this._getConfiguredWorldTokenMintAddress(), address)
  }

  async _waitForAddress(timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs
    let address = this.getAddress()
    while (!address && Date.now() < deadline) {
      await sleep(50)
      address = this.getAddress()
    }
    return address || null
  }

  async connect(player = this.world.entities.player) {
    this._assertLocalPlayer(player, 'connect')
    const walletAdapter = this._requireWalletAdapter()
    if (typeof walletAdapter.connect === 'function') {
      await walletAdapter.connect()
    }
    const address = this.getAddress() || (await this._waitForAddress())
    if (!address) {
      throw new Error('Solana wallet not connected')
    }
    this.world.network.send('solanaConnectChallengeRequest', {
      address,
    })
    this.emit('connect-requested', this.getSnapshot())
  }

  async disconnect(player = this.world.entities.player) {
    this._assertLocalPlayer(player, 'disconnect')
    this.world.network.send('solanaDisconnect')
    if (typeof this.walletAdapter?.disconnect === 'function') {
      await this.walletAdapter.disconnect()
    }
    this.emit('disconnect-requested', this.getSnapshot())
  }

  async deposit(...args) {
    const amount = args.at(-1)
    const player = args.length > 1 ? args.at(-2) : this.world.entities.player
    this._assertLocalPlayer(player, 'request a deposit for')
    const operation = this._createPendingOperation('deposit', amount)
    this.world.network.send('solanaDepositRequest', {
      requestId: operation.requestId,
      amount,
    })
    return operation.promise
  }

  async withdraw(...args) {
    const amount = args.at(-1)
    const player = args.length > 1 ? args.at(-2) : this.world.entities.player
    this._assertLocalPlayer(player, 'request a withdraw for')
    const operation = this._createPendingOperation('withdraw', amount)
    this.world.network.send('solanaWithdrawRequest', {
      requestId: operation.requestId,
      amount,
    })
    return operation.promise
  }

  async onSolanaConnectRequest() {
    try {
      await this.connect()
    } catch (error) {
      console.error(error)
    }
  }

  async onSolanaConnectChallenge({ challengeId, challenge }) {
    try {
      if (!challengeId) {
        throw new Error('Missing Solana challenge id')
      }
      const address = this.getAddress()
      if (!address) {
        throw new Error('Solana wallet not connected')
      }
      const messageBytes = decodeBase64(challenge)
      if (!messageBytes) {
        throw new Error('Invalid challenge payload')
      }
      const signature = await this.signMessageBytes(messageBytes)
      this.world.network.send('solanaConnectResponse', {
        challengeId,
        address,
        signature: encodeBase64(signature),
      })
    } catch (error) {
      this.world.network.send('solanaConnectResponse', {
        challengeId,
        address: this.getAddress(),
        error: error?.message || 'Failed to sign Solana challenge',
      })
    }
  }

  async onSolanaDisconnectRequest() {
    try {
      if (typeof this.walletAdapter?.disconnect === 'function') {
        await this.walletAdapter.disconnect()
      }
    } catch (error) {
      console.error(error)
    }
  }

  async onSolanaDepositSignatureRequest({ requestId, serializedTransaction }) {
    const operation = this.pendingOperations.get(requestId)
    try {
      const signedTransactionBytes = await this.signTransactionBytes(decodeBase64(serializedTransaction))
      if (operation) {
        this._emitOperationEvent(operation, { status: 'signed' })
      }
      this.world.network.send('solanaDepositSignatureResponse', {
        requestId,
        serializedTransaction: encodeBase64(signedTransactionBytes),
      })
    } catch (error) {
      if (operation) {
        this._emitOperationEvent(operation, {
          status: 'failed',
          error: error?.message || 'Failed to sign Solana deposit transaction',
        })
      }
      this.world.network.send('solanaDepositSignatureResponse', {
        requestId,
        error: error?.message || 'Failed to sign Solana deposit transaction',
      })
    }
  }

  onSolanaDepositResult(data) {
    this._resolvePendingOperation(data)
  }

  async onSolanaWithdrawSignatureRequest({ requestId, serializedTransaction }) {
    const operation = this.pendingOperations.get(requestId)
    try {
      const signedTransactionBytes = await this.signTransactionBytes(decodeBase64(serializedTransaction))
      if (operation) {
        this._emitOperationEvent(operation, { status: 'signed' })
      }
      this.world.network.send('solanaWithdrawSignatureResponse', {
        requestId,
        serializedTransaction: encodeBase64(signedTransactionBytes),
      })
    } catch (error) {
      if (operation) {
        this._emitOperationEvent(operation, {
          status: 'failed',
          error: error?.message || 'Failed to sign Solana withdraw transaction',
        })
      }
      this.world.network.send('solanaWithdrawSignatureResponse', {
        requestId,
        error: error?.message || 'Failed to sign Solana withdraw transaction',
      })
    }
  }

  onSolanaWithdrawResult(data) {
    this._resolvePendingOperation(data)
  }

  destroy() {
    for (const operation of this.pendingOperations.values()) {
      this._emitOperationEvent(operation, {
        status: 'failed',
        error: 'Solana operation was interrupted',
      })
      operation.reject(new Error('Solana operation was interrupted'))
    }
    this.pendingOperations.clear()
  }
}
