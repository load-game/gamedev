import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  generateKeyPairSigner,
  getTransactionDecoder,
  getTransactionEncoder,
  partiallySignTransaction,
  signBytes,
} from '@solana/kit'
import { TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda } from '@solana-program/token'

import { ClientSolana } from '../../src/core/systems/ClientSolana.js'
import { ServerSolana } from '../../src/core/systems/ServerSolana.js'

function createTaskQueue() {
  const pending = new Set()
  return {
    schedule(task) {
      if (!task || typeof task.then !== 'function') return
      pending.add(task)
      task.finally(() => pending.delete(task))
    },
    async flush() {
      while (pending.size > 0) {
        await Promise.all([...pending])
      }
    },
  }
}

async function createSolanaHarness({ serializeSignedTransactions = false } = {}) {
  const queue = createTaskQueue()
  const playerSigner = await generateKeyPairSigner()
  const worldSigner = await generateKeyPairSigner()
  const mintSigner = await generateKeyPairSigner()
  const mintAddress = mintSigner.address
  const [playerTokenAccount] = await findAssociatedTokenPda({
    owner: playerSigner.address,
    mint: mintAddress,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  })
  const [worldTokenAccount] = await findAssociatedTokenPda({
    owner: worldSigner.address,
    mint: mintAddress,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  })

  const walletState = {
    address: null,
    connected: false,
  }
  const submittedTransactions = []
  const entityModifiedPackets = []
  let tamperNextTransaction = false

  const playerEntity = {
    isPlayer: true,
    data: {
      id: 'player-1',
      solanaWallet: null,
    },
    modify(patch) {
      Object.assign(this.data, patch)
    },
  }
  const clientPlayerEntity = {
    data: {
      id: 'player-1',
      solanaWallet: null,
    },
  }

  let clientSolana
  let serverSolana

  const socket = {
    player: playerEntity,
    send(type, data) {
      if (type === 'solanaConnectRequest') {
        queue.schedule(clientSolana.onSolanaConnectRequest(data))
        return
      }
      if (type === 'solanaConnectChallenge') {
        queue.schedule(clientSolana.onSolanaConnectChallenge(data))
        return
      }
      if (type === 'solanaDisconnectRequest') {
        queue.schedule(clientSolana.onSolanaDisconnectRequest(data))
        return
      }
      if (type === 'solanaDepositSignatureRequest') {
        queue.schedule(clientSolana.onSolanaDepositSignatureRequest(data))
        return
      }
      if (type === 'solanaDepositResult') {
        clientSolana.onSolanaDepositResult(data)
        return
      }
      if (type === 'solanaWithdrawSignatureRequest') {
        queue.schedule(clientSolana.onSolanaWithdrawSignatureRequest(data))
        return
      }
      if (type === 'solanaWithdrawResult') {
        clientSolana.onSolanaWithdrawResult(data)
        return
      }
      throw new Error(`unexpected server packet: ${type}`)
    },
  }

  const clientWorld = {
    network: {
      id: 'player-1',
      send(type, data) {
        if (type === 'solanaConnectChallengeRequest') {
          queue.schedule(serverSolana.onSolanaConnectChallengeRequest(socket, data))
          return
        }
        if (type === 'solanaConnectResponse') {
          queue.schedule(serverSolana.onSolanaConnectResponse(socket, data))
          return
        }
        if (type === 'solanaDisconnect') {
          serverSolana.onSolanaDisconnect(socket)
          clientPlayerEntity.data.solanaWallet = null
          return
        }
        if (type === 'solanaDepositRequest') {
          queue.schedule(serverSolana.onSolanaDepositRequest(socket, data))
          return
        }
        if (type === 'solanaDepositSignatureResponse') {
          queue.schedule(serverSolana.onSolanaDepositSignatureResponse(socket, data))
          return
        }
        if (type === 'solanaWithdrawRequest') {
          queue.schedule(serverSolana.onSolanaWithdrawRequest(socket, data))
          return
        }
        if (type === 'solanaWithdrawSignatureResponse') {
          queue.schedule(serverSolana.onSolanaWithdrawSignatureResponse(socket, data))
          return
        }
        throw new Error(`unexpected client packet: ${type}`)
      },
    },
    entities: {
      player: clientPlayerEntity,
    },
  }

  const serverWorld = {
    entities: {
      getPlayer(id) {
        return id === playerEntity.data.id ? playerEntity : null
      },
    },
    network: {
      sockets: new Map([['player-1', socket]]),
      send(type, data) {
        if (type !== 'entityModified') {
          throw new Error(`unexpected broadcast packet: ${type}`)
        }
        entityModifiedPackets.push(data)
        if (Object.prototype.hasOwnProperty.call(data, 'solanaWallet')) {
          clientPlayerEntity.data.solanaWallet = data.solanaWallet || null
        }
      },
      sendTo(id, type, data) {
        assert.equal(id, playerEntity.data.id)
        socket.send(type, data)
      },
    },
  }

  clientSolana = new ClientSolana(clientWorld)
  serverSolana = new ServerSolana(serverWorld)

  serverSolana.transferRuntime = {
    mintAddress,
    worldAddress: worldSigner.address,
    worldSigner,
  }
  serverSolana._fetchMintAccount = async () => ({
    data: {
      decimals: 6,
    },
  })
  serverSolana._fetchMaybeTokenAccount = async tokenAddress => {
    if (tokenAddress === playerTokenAccount) {
      return {
        exists: true,
        address: tokenAddress,
        data: {
          mint: mintAddress,
          owner: playerSigner.address,
          amount: 10_000_000n,
        },
      }
    }
    if (tokenAddress === worldTokenAccount) {
      return {
        exists: true,
        address: tokenAddress,
        data: {
          mint: mintAddress,
          owner: worldSigner.address,
          amount: 10_000_000n,
        },
      }
    }
    return {
      exists: false,
      address: tokenAddress,
    }
  }
  serverSolana._getLatestBlockhash = async () => ({
    blockhash: '11111111111111111111111111111111',
    lastValidBlockHeight: 1n,
  })
  serverSolana._sendAndConfirmTransaction = async transaction => {
    submittedTransactions.push(transaction)
  }

  clientSolana.bind({
    address: null,
    connected: false,
    getAddress: () => walletState.address,
    isConnected: () => walletState.connected,
    connect: async () => {
      walletState.connected = true
      walletState.address = playerSigner.address
    },
    disconnect: async () => {
      walletState.connected = false
      walletState.address = null
    },
    signMessage: async bytes => signBytes(playerSigner.keyPair.privateKey, bytes),
    signTransaction: async bytes => {
      const decoded = getTransactionDecoder().decode(bytes)
      const transactionToSign = tamperNextTransaction
        ? {
            ...decoded,
            messageBytes: (() => {
              const nextBytes = Uint8Array.from(decoded.messageBytes)
              nextBytes[nextBytes.length - 1] ^= 1
              return nextBytes
            })(),
            signatures: { ...decoded.signatures },
          }
        : decoded
      const signed = await partiallySignTransaction([playerSigner.keyPair], transactionToSign)
      tamperNextTransaction = false
      const encoded = getTransactionEncoder().encode(signed)
      if (serializeSignedTransactions) {
        return {
          serialize() {
            return encoded
          },
        }
      }
      return encoded
    },
  })

  return {
    clientPlayerEntity,
    clientSolana,
    connectWallet() {
      walletState.connected = true
      walletState.address = playerSigner.address
      playerEntity.data.solanaWallet = playerSigner.address
      clientPlayerEntity.data.solanaWallet = playerSigner.address
    },
    disconnectWallet() {
      walletState.connected = false
      walletState.address = null
      playerEntity.data.solanaWallet = null
      clientPlayerEntity.data.solanaWallet = null
    },
    entityModifiedPackets,
    flush: queue.flush,
    mintAddress,
    playerEntity,
    playerSigner,
    playerTokenAccount,
    serverSolana,
    setTamperNextTransaction() {
      tamperNextTransaction = true
    },
    socket,
    submittedTransactions,
    worldSigner,
  }
}

test('solana runtime completes packet-driven connect and disconnect flow', async () => {
  const harness = await createSolanaHarness()

  harness.serverSolana.connect(harness.playerEntity)
  await harness.flush()

  assert.equal(harness.playerEntity.data.solanaWallet, harness.playerSigner.address)
  assert.equal(harness.clientPlayerEntity.data.solanaWallet, harness.playerSigner.address)
  assert.equal(harness.entityModifiedPackets.at(-1)?.solanaWallet, harness.playerSigner.address)

  await harness.clientSolana.disconnect()
  await harness.flush()

  assert.equal(harness.playerEntity.data.solanaWallet, null)
  assert.equal(harness.clientPlayerEntity.data.solanaWallet, null)
  assert.equal(harness.entityModifiedPackets.at(-1)?.solanaWallet, null)
})

test('solana runtime rejects replayed and expired connect challenges', async () => {
  const harness = await createSolanaHarness()
  harness.connectWallet()

  const recordedPackets = []
  const captureSocket = {
    ...harness.socket,
    send(type, data) {
      recordedPackets.push({ type, data })
    },
  }

  await harness.serverSolana.onSolanaConnectChallengeRequest(captureSocket, {
    address: harness.playerSigner.address,
  })
  const challengePacket = recordedPackets[0]
  assert.equal(challengePacket.type, 'solanaConnectChallenge')

  const challengeBytes = Uint8Array.from(Buffer.from(challengePacket.data.challenge, 'base64'))
  const replaySignature = await signBytes(harness.playerSigner.keyPair.privateKey, challengeBytes)
  const replayResponse = {
    challengeId: challengePacket.data.challengeId,
    address: harness.playerSigner.address,
    signature: Buffer.from(replaySignature).toString('base64'),
  }

  await harness.serverSolana.onSolanaConnectResponse(harness.socket, replayResponse)
  assert.equal(harness.playerEntity.data.solanaWallet, harness.playerSigner.address)

  harness.serverSolana.onSolanaDisconnect(harness.socket)
  assert.equal(harness.playerEntity.data.solanaWallet, null)

  await harness.serverSolana.onSolanaConnectResponse(harness.socket, replayResponse)
  assert.equal(harness.playerEntity.data.solanaWallet, null)

  await harness.serverSolana.onSolanaConnectChallengeRequest(captureSocket, {
    address: harness.playerSigner.address,
  })
  const expiredChallengePacket = recordedPackets.at(-1)
  const expiredChallenge = harness.serverSolana.connectChallenges.get(harness.playerEntity.data.id)
  expiredChallenge.expiresAt = Date.now() - 1
  const expiredBytes = Uint8Array.from(Buffer.from(expiredChallengePacket.data.challenge, 'base64'))
  const expiredSignature = await signBytes(harness.playerSigner.keyPair.privateKey, expiredBytes)

  await harness.serverSolana.onSolanaConnectResponse(harness.socket, {
    challengeId: expiredChallengePacket.data.challengeId,
    address: harness.playerSigner.address,
    signature: Buffer.from(expiredSignature).toString('base64'),
  })

  assert.equal(harness.playerEntity.data.solanaWallet, null)
})

test('solana runtime validates deposit request and response payloads', async () => {
  const harness = await createSolanaHarness()
  harness.connectWallet()
  harness.setTamperNextTransaction()

  const tamperedDepositPromise = harness.clientSolana.deposit('0.1')
  await harness.flush()
  await assert.rejects(tamperedDepositPromise, /payload mismatch/)
  assert.equal(harness.submittedTransactions.length, 0)

  const depositPromise = harness.clientSolana.deposit('0.5')
  await harness.flush()
  const result = await depositPromise

  assert.ok(typeof result.signature === 'string' && result.signature.length > 0)
  assert.equal(harness.submittedTransactions.length, 1)
  assert.deepEqual(Object.keys(harness.submittedTransactions[0].signatures), [harness.playerSigner.address])
  assert.ok(harness.submittedTransactions[0].signatures[harness.playerSigner.address])
})

test('solana runtime validates withdraw responses and adds the world signer', async () => {
  const harness = await createSolanaHarness()
  harness.connectWallet()

  const withdrawPromise = harness.clientSolana.withdraw('0.25')
  await harness.flush()
  const result = await withdrawPromise

  assert.ok(typeof result.signature === 'string' && result.signature.length > 0)
  assert.equal(harness.submittedTransactions.length, 1)
  assert.deepEqual(
    Object.keys(harness.submittedTransactions[0].signatures).sort(),
    [harness.playerSigner.address, harness.worldSigner.address].sort(),
  )
  assert.ok(harness.submittedTransactions[0].signatures[harness.playerSigner.address])
  assert.ok(harness.submittedTransactions[0].signatures[harness.worldSigner.address])
})

test('solana runtime supports injected-style signing and client balance helpers', async () => {
  const harness = await createSolanaHarness({ serializeSignedTransactions: true })
  const hadEnv = Object.prototype.hasOwnProperty.call(globalThis, 'env')
  const previousEnv = globalThis.env

  harness.clientSolana._fetchNativeBalance = async ownerAddress => {
    assert.equal(ownerAddress, harness.playerSigner.address)
    return 3_500_000_000n
  }
  harness.clientSolana._fetchMintAccount = async mintAddress => {
    assert.equal(mintAddress, harness.mintAddress)
    return {
      data: {
        decimals: 6,
      },
    }
  }
  harness.clientSolana._fetchMaybeTokenAccount = async tokenAddress => {
    assert.equal(tokenAddress, harness.playerTokenAccount)
    return {
      exists: true,
      address: tokenAddress,
      data: {
        amount: 1_250_000n,
      },
    }
  }

  globalThis.env = {
    ...(previousEnv || {}),
    PUBLIC_WORLD_TOKEN_MINT_ADDRESS: harness.mintAddress,
  }

  try {
    harness.serverSolana.connect(harness.playerEntity)
    await harness.flush()

    assert.equal(harness.clientSolana.getAddress(), harness.playerSigner.address)
    assert.equal(harness.clientSolana.isConnected(), true)
    assert.equal(await harness.clientSolana.getNativeBalance(), 3.5)
    assert.equal(await harness.clientSolana.getWorldTokenBalance(), 1.25)

    const depositPromise = harness.clientSolana.deposit('0.25')
    await harness.flush()
    const result = await depositPromise

    assert.ok(typeof result.signature === 'string' && result.signature.length > 0)
    assert.equal(harness.submittedTransactions.length, 1)
  } finally {
    if (hadEnv) {
      globalThis.env = previousEnv
    } else {
      delete globalThis.env
    }
  }
})

test('solana runtime emits operation lifecycle events for the richer transfer flow', async () => {
  const harness = await createSolanaHarness()
  harness.connectWallet()

  const events = []
  const onOperation = operation => {
    events.push({
      ...operation,
    })
  }

  harness.clientSolana.on('operation', onOperation)

  try {
    harness.setTamperNextTransaction()
    const failedDepositPromise = harness.clientSolana.deposit('0.1')
    await harness.flush()
    await assert.rejects(failedDepositPromise, /payload mismatch/)

    assert.deepEqual(
      events.map(event => event.status),
      ['pending', 'signed', 'failed'],
    )
    assert.equal(events[0].kind, 'deposit')

    events.length = 0

    const withdrawPromise = harness.clientSolana.withdraw('0.2')
    await harness.flush()
    const result = await withdrawPromise

    assert.deepEqual(
      events.map(event => event.status),
      ['pending', 'signed', 'confirmed'],
    )
    assert.equal(events[0].kind, 'withdraw')
    assert.equal(events.at(-1).signature, result.signature)
  } finally {
    harness.clientSolana.off('operation', onOperation)
  }
})
