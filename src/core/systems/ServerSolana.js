import {
  address,
  appendTransactionMessageInstructions,
  assertIsFullySignedTransaction,
  compileTransaction,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  createNoopSigner,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getBase58Encoder,
  getPublicKeyFromAddress,
  getSignatureFromTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
  getUtf8Encoder,
  partiallySignTransaction,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signatureBytes,
  verifySignature,
} from '@solana/kit'
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchMaybeToken,
  fetchMint,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction,
} from '@solana-program/token'

import { uuid } from '../utils'
import { System } from './System'

const CONNECT_CHALLENGE_TTL_MS = 60_000
const SOLANA_COMMITMENT = 'confirmed'
const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/

function isPlayer(entity) {
  return !!entity?.isPlayer && !!entity?.data?.id
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeSolanaAddress(value) {
  if (!isNonEmptyString(value)) return null
  try {
    return address(value.trim())
  } catch {
    return null
  }
}

function encodeBase64(bytes) {
  return Buffer.from(bytes).toString('base64')
}

function decodeBase64(value) {
  if (!isNonEmptyString(value)) return null
  try {
    if (!BASE64_REGEX.test(value.trim())) return null
    return new Uint8Array(Buffer.from(value, 'base64'))
  } catch {
    return null
  }
}

function toUint8Array(value) {
  if (!value) return null
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (Array.isArray(value)) return Uint8Array.from(value)
  return null
}

function bytesEqual(a, b) {
  const left = toUint8Array(a)
  const right = toUint8Array(b)
  if (!left || !right || left.byteLength !== right.byteLength) return false
  for (let i = 0; i < left.byteLength; i++) {
    if (left[i] !== right[i]) return false
  }
  return true
}

function createConnectChallengePayload({ playerId, address, nonce, issuedAt, expiresAt }) {
  return JSON.stringify({
    type: 'lobby-runtime-solana-connect',
    playerId,
    address,
    nonce,
    issuedAt,
    expiresAt,
  })
}

function normalizeRpcHttpUrl(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return ''
  if (normalized.startsWith('https://') || normalized.startsWith('http://')) return normalized
  if (normalized.startsWith('wss://')) return `https://${normalized.slice('wss://'.length)}`
  if (normalized.startsWith('ws://')) return `http://${normalized.slice('ws://'.length)}`
  return normalized
}

function normalizeRpcSubscriptionsUrl(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return ''
  if (normalized.startsWith('wss://') || normalized.startsWith('ws://')) return normalized
  if (normalized.startsWith('https://')) return `wss://${normalized.slice('https://'.length)}`
  if (normalized.startsWith('http://')) return `ws://${normalized.slice('http://'.length)}`
  return normalized
}

function requireEnvString(name) {
  const value = typeof process.env[name] === 'string' ? process.env[name].trim() : ''
  if (!value) {
    throw new Error(`[solana] ${name} is required`)
  }
  return value
}

function parseSolanaPrivateKey(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) {
    throw new Error('[solana] WORLD_PRIVATE_KEY is required')
  }

  if (trimmed.startsWith('[')) {
    let parsed
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      throw new Error('[solana] WORLD_PRIVATE_KEY JSON array is invalid')
    }
    if (!Array.isArray(parsed) || parsed.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
      throw new Error('[solana] WORLD_PRIVATE_KEY JSON array must contain byte values')
    }
    return Uint8Array.from(parsed)
  }

  try {
    return getBase58Encoder().encode(trimmed)
  } catch {
    const decodedBase64 = decodeBase64(trimmed)
    if (decodedBase64) return decodedBase64
    throw new Error('[solana] WORLD_PRIVATE_KEY must be base58, base64, or a JSON byte array')
  }
}

function parseTokenAmountToAtomicUnits(value, decimals) {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error('[solana] Invalid token decimals')
  }
  if (typeof value === 'bigint') {
    if (value <= 0n) {
      throw new Error('Amount must be greater than 0')
    }
    return value
  }

  const normalized =
    typeof value === 'number'
      ? Number.isFinite(value)
        ? value.toString()
        : ''
      : typeof value === 'string'
        ? value.trim()
        : ''

  if (!normalized || !/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error('Amount must be a positive decimal number')
  }

  const [wholePart, fractionPart = ''] = normalized.split('.')
  if (fractionPart.length > decimals) {
    throw new Error(`Amount supports up to ${decimals} decimal places`)
  }

  const decimalScale = 10n ** BigInt(decimals)
  const wholeValue = BigInt(wholePart || '0')
  const fractionValue = BigInt((fractionPart + '0'.repeat(decimals)).slice(0, decimals) || '0')
  const atomicValue = wholeValue * decimalScale + fractionValue
  if (atomicValue <= 0n) {
    throw new Error('Amount must be greater than 0')
  }
  return atomicValue
}

function getOperationPackets(kind) {
  if (kind === 'deposit') {
    return {
      signatureRequest: 'solanaDepositSignatureRequest',
      result: 'solanaDepositResult',
    }
  }
  return {
    signatureRequest: 'solanaWithdrawSignatureRequest',
    result: 'solanaWithdrawResult',
  }
}

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

export class ServerSolana extends System {
  constructor(world) {
    super(world)
    this.connectChallenges = new Map()
    this.pendingTransactions = new Map()
    this.transferRuntime = null
    this.transferRuntimePromise = null
  }

  _resolvePlayer(playerOrId) {
    if (isPlayer(playerOrId)) return playerOrId
    if (typeof playerOrId === 'string') {
      return this.world.entities.getPlayer(playerOrId) || null
    }
    if (typeof playerOrId?.id === 'string') {
      return this.world.entities.getPlayer(playerOrId.id) || null
    }
    return null
  }

  _clearConnectChallenge(playerOrId) {
    const playerId = typeof playerOrId === 'string' ? playerOrId : playerOrId?.data?.id || playerOrId?.id
    if (!playerId) return
    this.connectChallenges.delete(playerId)
  }

  _getPlayerSocket(player) {
    const playerId = player?.data?.id
    if (!playerId) return null
    return this.world.network?.sockets?.get?.(playerId) || null
  }

  _setPlayerWallet(player, solanaWallet) {
    if (!isPlayer(player)) return
    const nextWallet = typeof solanaWallet === 'string' && solanaWallet.trim() ? solanaWallet.trim() : null
    if ((player.data.solanaWallet || null) === nextWallet) return
    player.modify({ solanaWallet: nextWallet })
    this.world.network.send('entityModified', {
      id: player.data.id,
      solanaWallet: nextWallet,
    })
  }

  async _ensureTransferRuntime() {
    if (this.transferRuntime) return this.transferRuntime
    if (!this.transferRuntimePromise) {
      this.transferRuntimePromise = (async () => {
        const configuredRpcUrl = requireEnvString('RPC_URL')
        const rpcUrl = normalizeRpcHttpUrl(configuredRpcUrl)
        const rpcSubscriptionsUrl = normalizeRpcSubscriptionsUrl(configuredRpcUrl)
        const configuredWorldAddress = normalizeSolanaAddress(requireEnvString('WORLD_PUBLIC_KEY'))
        const mintAddress = normalizeSolanaAddress(requireEnvString('WORLD_TOKEN_MINT_ADDRESS'))
        const privateKeyBytes = parseSolanaPrivateKey(requireEnvString('WORLD_PRIVATE_KEY'))

        if (!configuredWorldAddress) {
          throw new Error('[solana] WORLD_PUBLIC_KEY is invalid')
        }
        if (!mintAddress) {
          throw new Error('[solana] WORLD_TOKEN_MINT_ADDRESS is invalid')
        }
        if (privateKeyBytes.byteLength !== 32 && privateKeyBytes.byteLength !== 64) {
          throw new Error('[solana] WORLD_PRIVATE_KEY must decode to 32 or 64 bytes')
        }

        const worldSigner =
          privateKeyBytes.byteLength === 64
            ? await createKeyPairSignerFromBytes(privateKeyBytes)
            : await createKeyPairSignerFromPrivateKeyBytes(privateKeyBytes)

        if (worldSigner.address !== configuredWorldAddress) {
          throw new Error('[solana] WORLD_PUBLIC_KEY does not match WORLD_PRIVATE_KEY')
        }

        const rpc = createSolanaRpc(rpcUrl)
        const rpcSubscriptions = createSolanaRpcSubscriptions(rpcSubscriptionsUrl)
        return {
          mintAddress,
          rpc,
          rpcSubscriptions,
          sendAndConfirmTransaction: sendAndConfirmTransactionFactory({
            rpc,
            rpcSubscriptions,
          }),
          worldAddress: configuredWorldAddress,
          worldSigner,
        }
      })()
        .then(runtime => {
          this.transferRuntime = runtime
          return runtime
        })
        .catch(error => {
          this.transferRuntimePromise = null
          throw error
        })
    }
    return await this.transferRuntimePromise
  }

  async _getLatestBlockhash() {
    const { rpc } = await this._ensureTransferRuntime()
    const response = await rpc.getLatestBlockhash({ commitment: SOLANA_COMMITMENT }).send()
    return response.value
  }

  async _fetchMintAccount(mintAddress) {
    const { rpc } = await this._ensureTransferRuntime()
    return fetchMint(rpc, mintAddress, { commitment: SOLANA_COMMITMENT })
  }

  async _fetchMaybeTokenAccount(tokenAccountAddress) {
    const { rpc } = await this._ensureTransferRuntime()
    return fetchMaybeToken(rpc, tokenAccountAddress, { commitment: SOLANA_COMMITMENT })
  }

  async _sendAndConfirmTransaction(transaction) {
    const { sendAndConfirmTransaction } = await this._ensureTransferRuntime()
    await sendAndConfirmTransaction(transaction, { commitment: SOLANA_COMMITMENT })
  }

  _sendOperationResult(kind, socket, requestId, payload) {
    if (!socket) return
    const packets = getOperationPackets(kind)
    socket.send(packets.result, {
      requestId,
      ...payload,
    })
  }

  _resolvePendingTransaction(pending, payload) {
    pending.resolve?.({
      requestId: pending.requestId,
      ...payload,
    })
    this._sendOperationResult(pending.kind, pending.socket, pending.requestId, payload)
  }

  _rejectPendingTransaction(pending, message) {
    const error = new Error(message)
    pending.reject?.(error)
    this._sendOperationResult(pending.kind, pending.socket, pending.requestId, {
      error: message,
    })
  }

  _cleanupPendingTransactionsForPlayer(playerId, errorMessage = 'Solana operation was interrupted') {
    if (!playerId) return
    for (const [requestId, pending] of this.pendingTransactions) {
      if (pending.playerId !== playerId) continue
      this.pendingTransactions.delete(requestId)
      pending.reject?.(new Error(errorMessage))
    }
  }

  async _buildPendingTransaction(kind, socket, requestId, amount) {
    const player = socket?.player
    const playerId = player?.data?.id
    if (!player || !playerId) {
      throw new Error('Player not found')
    }

    const playerAddress = normalizeSolanaAddress(player.data.solanaWallet)
    if (!playerAddress) {
      throw new Error('Connect a Solana wallet first')
    }

    const runtime = await this._ensureTransferRuntime()
    const mintAccount = await this._fetchMintAccount(runtime.mintAddress)
    const decimals = mintAccount.data.decimals
    const amountAtomic = parseTokenAmountToAtomicUnits(amount, decimals)

    const [playerTokenAccount] = await findAssociatedTokenPda({
      owner: playerAddress,
      mint: runtime.mintAddress,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    })
    const [worldTokenAccount] = await findAssociatedTokenPda({
      owner: runtime.worldAddress,
      mint: runtime.mintAddress,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    })

    const sourceTokenAccount = kind === 'deposit' ? playerTokenAccount : worldTokenAccount
    const destinationTokenAccount = kind === 'deposit' ? worldTokenAccount : playerTokenAccount
    const sourceAuthorityAddress = kind === 'deposit' ? playerAddress : runtime.worldAddress
    const destinationOwnerAddress = kind === 'deposit' ? runtime.worldAddress : playerAddress

    const sourceTokenAccountInfo = await this._fetchMaybeTokenAccount(sourceTokenAccount)
    if (!sourceTokenAccountInfo.exists) {
      throw new Error(kind === 'deposit' ? 'Player token account not found' : 'World token account not found')
    }
    if (sourceTokenAccountInfo.data.mint !== runtime.mintAddress) {
      throw new Error('Token account mint mismatch')
    }
    if (sourceTokenAccountInfo.data.owner !== sourceAuthorityAddress) {
      throw new Error('Token account owner mismatch')
    }
    if (sourceTokenAccountInfo.data.amount < amountAtomic) {
      throw new Error('Insufficient token balance')
    }

    const playerSigner = createNoopSigner(playerAddress)
    const transferAuthority = kind === 'deposit' ? playerSigner : createNoopSigner(runtime.worldAddress)
    const instructions = [
      getCreateAssociatedTokenIdempotentInstruction({
        payer: playerSigner,
        ata: destinationTokenAccount,
        owner: destinationOwnerAddress,
        mint: runtime.mintAddress,
      }),
      getTransferCheckedInstruction({
        source: sourceTokenAccount,
        mint: runtime.mintAddress,
        destination: destinationTokenAccount,
        authority: transferAuthority,
        amount: amountAtomic,
        decimals,
      }),
    ]

    const latestBlockhash = await this._getLatestBlockhash()
    let transactionMessage = createTransactionMessage({ version: 0 })
    transactionMessage = setTransactionMessageFeePayerSigner(playerSigner, transactionMessage)
    transactionMessage = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, transactionMessage)
    transactionMessage = appendTransactionMessageInstructions(instructions, transactionMessage)

    const unsignedTransaction = compileTransaction(transactionMessage)
    const unsignedTransactionBytes = getTransactionEncoder().encode(unsignedTransaction)

    return {
      amountAtomic,
      decimals,
      destinationTokenAccount,
      kind,
      mintAddress: runtime.mintAddress,
      playerAddress,
      playerId,
      requestId,
      socket,
      sourceTokenAccount,
      unsignedTransaction,
      unsignedTransactionBytes,
      worldAddress: runtime.worldAddress,
    }
  }

  async _startPendingTransaction(kind, socket, data, handlers = null) {
    const requestId = isNonEmptyString(data?.requestId) ? data.requestId : uuid()
    if (this.pendingTransactions.has(requestId)) {
      const message = 'Duplicate Solana transaction request'
      handlers?.reject?.(new Error(message))
      this._sendOperationResult(kind, socket, requestId, { error: message })
      return
    }

    let pending
    try {
      pending = await this._buildPendingTransaction(kind, socket, requestId, data?.amount)
    } catch (error) {
      const message = error?.message || `Failed to build Solana ${kind} transaction`
      handlers?.reject?.(new Error(message))
      this._sendOperationResult(kind, socket, requestId, { error: message })
      return
    }

    this.pendingTransactions.set(requestId, {
      ...pending,
      reject: handlers?.reject || null,
      resolve: handlers?.resolve || null,
    })

    const packets = getOperationPackets(kind)
    socket.send(packets.signatureRequest, {
      requestId,
      serializedTransaction: encodeBase64(pending.unsignedTransactionBytes),
    })
  }

  _assertSignedTransactionMatchesPending(pending, signedTransaction) {
    const expectedMessageBytes = pending.unsignedTransaction?.messageBytes
    if (!bytesEqual(expectedMessageBytes, signedTransaction?.messageBytes)) {
      throw new Error(`Signed Solana ${pending.kind} transaction payload mismatch`)
    }

    const expectedSignerAddresses =
      pending.kind === 'withdraw'
        ? [pending.playerAddress, pending.worldAddress].sort()
        : [pending.playerAddress]
    const actualSignerAddresses = Object.keys(signedTransaction?.signatures || {}).sort()
    if (
      actualSignerAddresses.length !== expectedSignerAddresses.length ||
      actualSignerAddresses.some((address, index) => address !== expectedSignerAddresses[index])
    ) {
      throw new Error(`Signed Solana ${pending.kind} signer set mismatch`)
    }
  }

  async _verifyPlayerTransactionSignature(pending, signedTransaction) {
    const playerSignature = signedTransaction?.signatures?.[pending.playerAddress]
    if (!playerSignature) {
      throw new Error('Missing player transaction signature')
    }
    const playerPublicKey = await getPublicKeyFromAddress(pending.playerAddress)
    const valid = await verifySignature(playerPublicKey, signatureBytes(playerSignature), signedTransaction.messageBytes)
    if (!valid) {
      throw new Error('Invalid player transaction signature')
    }
  }

  async _completePendingTransaction(kind, socket, data) {
    const requestId = isNonEmptyString(data?.requestId) ? data.requestId : null
    if (!requestId) return

    const pending = this.pendingTransactions.get(requestId)
    if (!pending || pending.kind !== kind) return
    if (pending.playerId !== socket?.player?.data?.id) return
    this.pendingTransactions.delete(requestId)

    if (data?.error) {
      this._rejectPendingTransaction(pending, data.error)
      return
    }

    const serializedTransactionBytes = decodeBase64(data?.serializedTransaction)
    if (!serializedTransactionBytes) {
      this._rejectPendingTransaction(pending, 'Invalid signed Solana transaction')
      return
    }

    try {
      const signedTransaction = getTransactionDecoder().decode(serializedTransactionBytes)
      this._assertSignedTransactionMatchesPending(pending, signedTransaction)
      await this._verifyPlayerTransactionSignature(pending, signedTransaction)

      let transactionToSubmit = signedTransaction
      if (kind === 'withdraw') {
        const { worldSigner } = await this._ensureTransferRuntime()
        transactionToSubmit = await partiallySignTransaction([worldSigner.keyPair], signedTransaction)
      }

      assertIsFullySignedTransaction(transactionToSubmit)
      const signature = getSignatureFromTransaction(transactionToSubmit)
      await this._sendAndConfirmTransaction(transactionToSubmit)

      this._resolvePendingTransaction(pending, {
        signature,
      })
    } catch (error) {
      this._rejectPendingTransaction(
        pending,
        error?.message || `Failed to submit Solana ${kind} transaction`
      )
    }
  }

  connect(playerOrId) {
    const player = this._resolvePlayer(playerOrId)
    if (!player) {
      throw new Error('Player not found')
    }
    this.world.network.sendTo(player.data.id, 'solanaConnectRequest')
  }

  disconnect(playerOrId) {
    const player = this._resolvePlayer(playerOrId)
    if (!player) {
      throw new Error('Player not found')
    }
    this._clearConnectChallenge(player)
    this._setPlayerWallet(player, null)
    this.world.network.sendTo(player.data.id, 'solanaDisconnectRequest')
  }

  async deposit(...args) {
    const amount = args.at(-1)
    const player = this._resolvePlayer(args.length > 1 ? args.at(-2) : null)
    if (!player) {
      throw new Error('Player not found')
    }
    const socket = this._getPlayerSocket(player)
    if (!socket) {
      throw new Error('Player is not connected')
    }
    const deferred = createDeferred()
    await this._startPendingTransaction(
      'deposit',
      socket,
      {
        requestId: uuid(),
        amount,
      },
      deferred,
    )
    return deferred.promise
  }

  async withdraw(...args) {
    const amount = args.at(-1)
    const player = this._resolvePlayer(args.length > 1 ? args.at(-2) : null)
    if (!player) {
      throw new Error('Player not found')
    }
    const socket = this._getPlayerSocket(player)
    if (!socket) {
      throw new Error('Player is not connected')
    }
    const deferred = createDeferred()
    await this._startPendingTransaction(
      'withdraw',
      socket,
      {
        requestId: uuid(),
        amount,
      },
      deferred,
    )
    return deferred.promise
  }

  onSolanaConnectChallengeRequest(socket, data) {
    const player = socket?.player
    const playerId = player?.data?.id
    if (!player || !playerId) return

    const playerAddress = normalizeSolanaAddress(data?.address)
    if (!playerAddress) return

    const challengeId = uuid()
    const nonce = uuid()
    const issuedAt = Date.now()
    const expiresAt = issuedAt + CONNECT_CHALLENGE_TTL_MS
    const payload = createConnectChallengePayload({
      playerId,
      address: playerAddress,
      nonce,
      issuedAt,
      expiresAt,
    })
    const challengeBytes = getUtf8Encoder().encode(payload)

    this.connectChallenges.set(playerId, {
      challengeId,
      nonce,
      address: playerAddress,
      issuedAt,
      expiresAt,
      challengeBytes,
    })

    socket.send('solanaConnectChallenge', {
      challengeId,
      nonce,
      issuedAt,
      expiresAt,
      challenge: encodeBase64(challengeBytes),
    })
  }

  async onSolanaConnectResponse(socket, data) {
    const player = socket?.player
    const playerId = player?.data?.id
    if (!player || !playerId) return

    const challenge = this.connectChallenges.get(playerId)
    if (!challenge) return
    if (challenge.challengeId !== data?.challengeId) return

    this.connectChallenges.delete(playerId)

    if (data?.error) return
    if (Date.now() > challenge.expiresAt) return

    const responseAddress = normalizeSolanaAddress(data?.address)
    if (!responseAddress || responseAddress !== challenge.address) return

    const rawSignature = decodeBase64(data?.signature)
    if (!rawSignature) return

    try {
      const publicKey = await getPublicKeyFromAddress(challenge.address)
      const valid = await verifySignature(publicKey, signatureBytes(rawSignature), challenge.challengeBytes)
      if (!valid) return
    } catch {
      return
    }

    this._setPlayerWallet(player, challenge.address)
  }

  onSolanaDisconnect(socket) {
    this._clearConnectChallenge(socket?.player)
    this._setPlayerWallet(socket.player, null)
  }

  async onSolanaDepositRequest(socket, data) {
    await this._startPendingTransaction('deposit', socket, data)
  }

  async onSolanaDepositSignatureResponse(socket, data) {
    await this._completePendingTransaction('deposit', socket, data)
  }

  async onSolanaWithdrawRequest(socket, data) {
    await this._startPendingTransaction('withdraw', socket, data)
  }

  async onSolanaWithdrawSignatureResponse(socket, data) {
    await this._completePendingTransaction('withdraw', socket, data)
  }

  onSocketDisconnect(socket) {
    const playerId = socket?.player?.data?.id
    if (!playerId) return
    this._clearConnectChallenge(playerId)
    this._cleanupPendingTransactionsForPlayer(playerId)
  }
}
