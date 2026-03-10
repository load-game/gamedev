import 'ses'
import '../core/lockdown'
import { getAddress } from 'ethers'
import { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth'
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana'
import { arbitrum } from '@privy-io/chains'

import { storage } from '../core/storage'
import { Client } from './world-client'

function buildWsUrl(baseUrl, token) {
  try {
    const url = new URL(baseUrl)
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/ws'
    }
    if (token) {
      url.searchParams.set('authToken', token)
    }
    return url.toString()
  } catch {
    return baseUrl
  }
}

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function resolveRuntimeApiUrl() {
  if (env.PUBLIC_API_URL) return env.PUBLIC_API_URL
  if (typeof window === 'undefined') return null
  return `${window.location.origin}/api`
}

function resolveStandaloneWsUrl(apiUrl) {
  if (env.PUBLIC_WS_URL) return env.PUBLIC_WS_URL
  if (apiUrl) {
    return apiUrl
      .replace(/\/api\/?$/, '/ws')
      .replace(/^http:/, 'ws:')
      .replace(/^https:/, 'wss:')
  }
  if (typeof window === 'undefined') return null
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
}

function resolveAuthEndpoint(authBaseUrl, pathSuffix) {
  const base = authBaseUrl.replace(/\/+$/, '')
  const suffix = pathSuffix.replace(/^\/+/, '')
  return `${base}/${suffix}`
}

function createAuthError(message, status, { skipAuth = false } = {}) {
  const err = new Error(message)
  if (status) err.status = status
  if (skipAuth) err.skipAuth = true
  return err
}

const DEFAULT_EVM_CHAIN = arbitrum
const DEFAULT_EVM_CHAIN_ID = DEFAULT_EVM_CHAIN.id

function toHexString(value) {
  const bytes = new TextEncoder().encode(String(value))
  return `0x${[...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

function getEthereumWalletProvider() {
  if (typeof window === 'undefined') return null
  const provider = window.ethereum
  if (!provider || typeof provider.request !== 'function') return null
  return provider
}

function getSolanaWalletProvider() {
  if (typeof window === 'undefined') return null
  const candidates = [
    window.solana,
    window.phantom?.solana,
    window.backpack,
    window.backpack?.solana,
  ]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const canConnect = typeof candidate.connect === 'function'
    const canSign = typeof candidate.signMessage === 'function'
    if (canConnect && canSign) return candidate
  }
  return null
}

function getWalletProvider(chain = 'ethereum') {
  return chain === 'solana' ? getSolanaWalletProvider() : getEthereumWalletProvider()
}

function normalizeHexAddress(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return /^0x[a-fA-F0-9]{40}$/.test(normalized) ? normalized : ''
}

function normalizeSiweAddress(address) {
  const normalized = normalizeHexAddress(address)
  if (!normalized) return ''
  try {
    return getAddress(normalized)
  } catch {
    return normalized
  }
}

function normalizeSolanaAddress(value) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(normalized) ? normalized : ''
}

function normalizeWalletChain(chain) {
  return chain === 'solana' ? 'solana' : 'ethereum'
}

function normalizeWalletAddressForChain(chain, address) {
  return chain === 'solana' ? normalizeSolanaAddress(address) : normalizeSiweAddress(address)
}

function normalizeSolanaNetwork(network) {
  return network === 'devnet' ? 'devnet' : 'mainnet'
}

function toUint8Array(value) {
  if (!value) return null
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  if (Array.isArray(value)) return Uint8Array.from(value)
  return null
}

function bytesToBase64(bytes) {
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function readSolanaProviderAddress(provider) {
  const value = provider?.publicKey?.toBase58?.() || provider?.publicKey?.toString?.() || provider?.publicKey
  return normalizeSolanaAddress(value)
}

function readSolanaProviderNetwork(provider) {
  const candidates = [
    provider?.network,
    provider?.cluster,
    provider?.connection?.rpcEndpoint,
    provider?.rpcEndpoint,
  ]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const normalized = candidate.trim().toLowerCase()
    if (!normalized) continue
    if (normalized.includes('devnet')) return 'devnet'
    if (normalized.includes('mainnet')) return 'mainnet'
  }
  return ''
}

function extractSolanaSignatureBytes(value) {
  if (!value) return null
  if (value.signature) {
    return toUint8Array(value.signature)
  }
  return toUint8Array(value)
}

function buildSiweMessage({ domain, address, uri, chainId, nonce }) {
  return `${domain} wants you to sign in with your Ethereum account:
${address}

Sign in with Ethereum

URI: ${uri}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`
}

function buildSiwsMessage({ domain, address, uri, nonce, network }) {
  return `${domain} wants you to sign in with your Solana account:
${address}

Sign in with Solana

URI: ${uri}
Version: 1
Network: ${network}
Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`
}

function getProviderChainId(provider) {
  return provider
    .request({ method: 'eth_chainId' })
    .then(chainId => {
      const parsed = Number.parseInt(chainId, 16)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EVM_CHAIN_ID
    })
    .catch(() => DEFAULT_EVM_CHAIN_ID)
}

async function requestWalletAddress(provider) {
  const getAccounts = await provider.request({ method: 'eth_accounts' }).catch(() => [])
  let address = normalizeHexAddress(Array.isArray(getAccounts) ? getAccounts[0] : '')
  if (!address) {
    try {
      const requestedAccounts = await provider.request({ method: 'eth_requestAccounts' })
      address = normalizeHexAddress(Array.isArray(requestedAccounts) ? requestedAccounts[0] : '')
    } catch (err) {
      if (err?.code === 4001) {
        throw createAuthError('Wallet sign-in request was rejected', 401, { skipAuth: true })
      }
      throw err
    }
  }
  if (!address) {
    throw createAuthError('No wallet account available', 401, { skipAuth: true })
  }
  return normalizeSiweAddress(address)
}

async function requestSolanaWalletAddress(provider) {
  if (!provider || typeof provider.connect !== 'function') {
    throw createAuthError('No Solana wallet provider found', 401, { skipAuth: true })
  }

  let address = readSolanaProviderAddress(provider)
  if (address) {
    return address
  }

  try {
    await provider.connect({ onlyIfTrusted: true })
    address = readSolanaProviderAddress(provider)
    if (address) return address
  } catch {
    // Non-fatal: we can still request an interactive connect.
  }

  try {
    await provider.connect()
  } catch (err) {
    if (err?.code === 4001 || err?.code === '4001') {
      throw createAuthError('Wallet sign-in request was rejected', 401, { skipAuth: true })
    }
    throw err
  }

  address = readSolanaProviderAddress(provider)
  if (!address) {
    throw createAuthError('No Solana wallet account available', 401, { skipAuth: true })
  }
  return address
}

async function requestSiweNonce(authBaseUrl, address, { onStatus } = {}) {
  const endpoint = resolveAuthEndpoint(authBaseUrl, 'nonce')
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ address }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unable to request SIWE nonce' }))
    throw createAuthError(error.message || error.error || 'Unable to request SIWE nonce', res.status)
  }
  const data = await res.json()
  const nonce = typeof data?.nonce === 'string' ? data.nonce.trim() : ''
  if (!nonce) {
    throw createAuthError('Missing SIWE nonce', 401)
  }
  onStatus?.('auth', 'Sign-in nonce received...')
  return nonce
}

async function requestSiwsNonce(authBaseUrl, address, network, { onStatus } = {}) {
  const endpoint = resolveAuthEndpoint(authBaseUrl, 'solana/nonce')
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ address, network }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unable to request SIWS nonce' }))
    throw createAuthError(error.message || error.error || 'Unable to request SIWS nonce', res.status)
  }
  const data = await res.json()
  const nonce = typeof data?.nonce === 'string' ? data.nonce.trim() : ''
  if (!nonce) {
    throw createAuthError('Missing SIWS nonce', 401)
  }
  onStatus?.('auth', 'Solana sign-in nonce received...')
  return nonce
}

async function verifySiweMessage(authBaseUrl, message, signature, { onStatus } = {}) {
  const endpoint = resolveAuthEndpoint(authBaseUrl, 'verify')
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ message, signature }),
    credentials: 'include',
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unable to verify SIWE signature' }))
    const statusError = createAuthError(error.message || error.error || 'Unable to verify SIWE signature', res.status)
    if (res.status === 401) statusError.skipAuth = true
    throw statusError
  }
  onStatus?.('auth', 'Wallet signature verified...')
}

async function verifySiwsMessage(authBaseUrl, message, signature, { onStatus } = {}) {
  const endpoint = resolveAuthEndpoint(authBaseUrl, 'solana/verify')
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ message, signature }),
    credentials: 'include',
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unable to verify SIWS signature' }))
    const statusError = createAuthError(error.message || error.error || 'Unable to verify SIWS signature', res.status)
    if (res.status === 401) statusError.skipAuth = true
    throw statusError
  }
  onStatus?.('auth', 'Solana signature verified...')
}

async function signSiwePayload(provider, address, message, { onStatus } = {}) {
  const encodedMessage = toHexString(message)
  try {
    return await provider.request({ method: 'personal_sign', params: [encodedMessage, address] })
  } catch (firstError) {
    try {
      return await provider.request({ method: 'personal_sign', params: [message, address] })
    } catch {
      onStatus?.('error', firstError?.message || 'Wallet signature was rejected')
      throw createAuthError('Unable to sign SIWE payload', 401, { skipAuth: true })
    }
  }
}

async function signSiwsPayload(provider, message, { onStatus } = {}) {
  if (!provider || typeof provider.signMessage !== 'function') {
    throw createAuthError('Solana message signing is unavailable', 401, { skipAuth: true })
  }
  const messageBytes = new TextEncoder().encode(message)
  try {
    const signed = await provider.signMessage(messageBytes, 'utf8')
    const signatureBytes = extractSolanaSignatureBytes(signed)
    if (!signatureBytes || !signatureBytes.length) {
      throw new Error('Invalid SIWS signature payload')
    }
    return bytesToBase64(signatureBytes)
  } catch (err) {
    onStatus?.('error', err?.message || 'Wallet signature was rejected')
    throw createAuthError('Unable to sign SIWS payload', 401, { skipAuth: true })
  }
}

async function performSiweLoginWithProvider(provider, authBaseUrl, onStatus) {
  if (!provider || typeof provider.request !== 'function') {
    throw createAuthError('No wallet provider found', 401, { skipAuth: true })
  }
  const address = await requestWalletAddress(provider)
  onStatus?.('auth', `Signing in as ${address.slice(0, 6)}...${address.slice(-4)}...`)

  const nonce = await requestSiweNonce(authBaseUrl, address, { onStatus })
  const chainId = await getProviderChainId(provider)
  const parsedUrl = new URL(authBaseUrl.replace(/\/+$/, ''))
  const message = buildSiweMessage({
    domain: parsedUrl.hostname,
    address,
    uri: `${parsedUrl.protocol}//${parsedUrl.host}`,
    chainId,
    nonce,
  })

  const signature = await signSiwePayload(provider, address, message, { onStatus })
  await verifySiweMessage(authBaseUrl, message, signature, { onStatus })
  onStatus?.('auth', 'Wallet login complete')
}

async function performSiwsLoginWithProvider(provider, authBaseUrl, { network = 'mainnet' } = {}, onStatus) {
  if (!provider || typeof provider.connect !== 'function') {
    throw createAuthError('No Solana wallet provider found', 401, { skipAuth: true })
  }
  const normalizedNetwork = normalizeSolanaNetwork(network)
  const address = await requestSolanaWalletAddress(provider)
  onStatus?.('auth', `Signing in with Solana ${address.slice(0, 4)}...${address.slice(-4)}...`)

  const nonce = await requestSiwsNonce(authBaseUrl, address, normalizedNetwork, { onStatus })
  const parsedUrl = new URL(authBaseUrl.replace(/\/+$/, ''))
  const message = buildSiwsMessage({
    domain: parsedUrl.hostname,
    address,
    uri: `${parsedUrl.protocol}//${parsedUrl.host}`,
    network: normalizedNetwork,
    nonce,
  })

  const signature = await signSiwsPayload(provider, message, { onStatus })
  await verifySiwsMessage(authBaseUrl, message, signature, { onStatus })
  onStatus?.('auth', 'Wallet login complete')
}

async function fetchIdentityExchangeToken(authBaseUrl) {
  const endpoint = resolveAuthEndpoint(authBaseUrl, 'exchange')
  const res = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unable to authenticate' }))
    const err = new Error(error.message || error.error || 'Unable to authenticate')
    err.status = res.status
    throw err
  }
  const data = await res.json()
  const token = typeof data?.token === 'string' ? data.token.trim() : ''
  if (!token) {
    throw new Error('Missing identity exchange token')
  }
  return token
}

async function fetchAuthMe(authBaseUrl) {
  const endpoint = resolveAuthEndpoint(authBaseUrl, 'me')
  const res = await fetch(endpoint, {
    method: 'GET',
    credentials: 'include',
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unable to fetch session' }))
    throw createAuthError(error.message || error.error || 'Unable to fetch session', res.status)
  }
  return res.json()
}

async function createPrivyAuthSession(authBaseUrl, accessToken) {
  const endpoint = resolveAuthEndpoint(authBaseUrl, 'privy/session')
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
    credentials: 'include',
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unable to authorize Privy session' }))
    throw createAuthError(error.message || error.error || 'Unable to authorize Privy session', res.status)
  }
  return res.json().catch(() => null)
}

async function logoutAuthSession(authBaseUrl) {
  const endpoint = resolveAuthEndpoint(authBaseUrl, 'logout')
  const res = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unable to logout' }))
    throw createAuthError(error.message || error.error || 'Unable to logout', res.status)
  }
  return true
}

async function updateAuthProfile(authBaseUrl, patch) {
  const endpoint = resolveAuthEndpoint(authBaseUrl, 'profile')
  const payload = {}
  if (typeof patch?.name === 'string') payload.name = patch.name
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'avatar')) {
    payload.avatar = patch.avatar
  }
  const res = await fetch(endpoint, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unable to update profile' }))
    throw createAuthError(error.message || error.error || 'Unable to update profile', res.status)
  }
  return res.json().catch(() => null)
}

function clearRuntimeAuthState() {
  storage.remove('authToken')
}

async function exchangeForRuntimeSession(runtimeApiUrl, identityToken) {
  const res = await fetch(`${runtimeApiUrl.replace(/\/+$/, '')}/auth/exchange`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ token: identityToken }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unable to exchange token' }))
    throw new Error(error.message || error.error || 'Unable to exchange token')
  }
  const data = await res.json()
  const token = typeof data?.token === 'string' ? data.token.trim() : ''
  if (!token) {
    throw new Error('Missing runtime session token')
  }
  return token
}

async function getConnectionUrl(onStatus) {
  const apiUrl = resolveRuntimeApiUrl()
  const usesLobbyIdentity = hasValue(env.PUBLIC_AUTH_URL)

  if (!apiUrl) {
    throw new Error('PUBLIC_API_URL is required')
  }

  const baseWsUrl = resolveStandaloneWsUrl(apiUrl)
  if (!baseWsUrl) {
    throw new Error('PUBLIC_WS_URL is required for runtime connection')
  }

  if (usesLobbyIdentity) {
    const authBaseUrl = env.PUBLIC_AUTH_URL
    onStatus?.('auth', 'Authorizing...')
    let hasSession = false
    try {
      await fetchAuthMe(authBaseUrl)
      hasSession = true
    } catch (err) {
      if (err?.status === 401) {
        const authBridge = globalThis.__runtimeAuth
        if (authBridge?.mode === 'privy' && typeof authBridge.ensureSession === 'function') {
          onStatus?.('auth', 'Restoring Privy session...')
          const restored = await authBridge.ensureSession({ onStatus }).catch(() => false)
          if (restored) {
            await fetchAuthMe(authBaseUrl)
              .then(() => {
                hasSession = true
              })
              .catch(() => {})
          }
        }
        if (!hasSession) {
          onStatus?.('connecting', 'Continuing as guest...')
          return buildWsUrl(baseWsUrl)
        }
      } else {
        throw err
      }
    }

    const identityToken = await fetchIdentityExchangeToken(authBaseUrl)
    const runtimeSessionToken = await exchangeForRuntimeSession(apiUrl, identityToken)
    return buildWsUrl(baseWsUrl, runtimeSessionToken)
  }

  return buildWsUrl(baseWsUrl)
}

function createInjectedRuntimeAuthBridge(authBaseUrl) {
  return {
    enabled: !!authBaseUrl,
    mode: 'injected',
    hasWalletProvider(chain) {
      const normalizedChain = chain === 'any' ? 'any' : normalizeWalletChain(chain)
      if (normalizedChain === 'any') {
        return !!getEthereumWalletProvider() || !!getSolanaWalletProvider()
      }
      return !!getWalletProvider(normalizedChain)
    },
    getWalletProvider(chain = 'ethereum') {
      return getWalletProvider(normalizeWalletChain(chain))
    },
    normalizeSiweAddress,
    normalizeSolanaAddress,
    normalizeWalletAddressForChain,
    async connectWalletSession({ chain = 'ethereum', network = 'mainnet', onStatus } = {}) {
      if (!authBaseUrl) {
        throw createAuthError('Wallet auth is unavailable', 404, { skipAuth: true })
      }
      const normalizedChain = normalizeWalletChain(chain)
      if (normalizedChain === 'solana') {
        const provider = getSolanaWalletProvider()
        if (!provider) {
          throw createAuthError('No Solana wallet provider found', 401, { skipAuth: true })
        }
        await performSiwsLoginWithProvider(provider, authBaseUrl, { network }, onStatus)
      } else {
        const provider = getEthereumWalletProvider()
        if (!provider) {
          throw createAuthError('No wallet provider found', 401, { skipAuth: true })
        }
        await performSiweLoginWithProvider(provider, authBaseUrl, onStatus)
      }
      return fetchAuthMe(authBaseUrl).catch(() => null)
    },
    async ensureSession() {
      return false
    },
    async getSessionUser() {
      if (!authBaseUrl) return null
      return fetchAuthMe(authBaseUrl).catch(() => null)
    },
    async updateProfile(patch) {
      if (!authBaseUrl) {
        throw createAuthError('Wallet auth is unavailable', 404, { skipAuth: true })
      }
      return updateAuthProfile(authBaseUrl, patch)
    },
    async logoutAndClearSession() {
      if (authBaseUrl) {
        await logoutAuthSession(authBaseUrl).catch(() => {})
      }
      clearRuntimeAuthState()
    },
    clearRuntimeAuthState,
    async getActiveWalletAddress({ chain = 'ethereum' } = {}) {
      const normalizedChain = normalizeWalletChain(chain)
      if (normalizedChain === 'solana') {
        const provider = getSolanaWalletProvider()
        if (!provider) return ''
        return readSolanaProviderAddress(provider)
      }
      const provider = getEthereumWalletProvider()
      if (!provider || typeof provider.request !== 'function') return ''
      const accounts = await provider.request({ method: 'eth_accounts' }).catch(() => [])
      return normalizeSiweAddress(Array.isArray(accounts) ? accounts[0] : '')
    },
    async getActiveWalletNetwork({ chain = 'ethereum' } = {}) {
      const normalizedChain = normalizeWalletChain(chain)
      if (normalizedChain !== 'solana') return null
      const provider = getSolanaWalletProvider()
      if (!provider) return null
      return readSolanaProviderNetwork(provider) || null
    },
    subscribeAccountChanges(listener, { chain = 'ethereum' } = {}) {
      if (typeof listener !== 'function') {
        return () => {}
      }

      const normalizedChain = normalizeWalletChain(chain)
      if (normalizedChain === 'solana') {
        const provider = getSolanaWalletProvider()
        if (!provider || typeof provider.on !== 'function') {
          return () => {}
        }

        const onAccountChanged = publicKey => {
          const nextAddress = normalizeSolanaAddress(publicKey?.toBase58?.() || publicKey?.toString?.() || publicKey || '')
          listener(nextAddress)
        }
        provider.on('accountChanged', onAccountChanged)
        return () => {
          provider.removeListener?.('accountChanged', onAccountChanged)
        }
      }

      const provider = getEthereumWalletProvider()
      if (!provider || typeof provider.on !== 'function') {
        return () => {}
      }

      const onAccountsChanged = accounts => {
        const nextAddress = normalizeSiweAddress(Array.isArray(accounts) ? accounts[0] : '')
        listener(nextAddress)
      }
      provider.on('accountsChanged', onAccountsChanged)
      return () => {
        provider.removeListener?.('accountsChanged', onAccountsChanged)
      }
    },
  }
}

const PRIVY_WALLET_WAIT_MS = 7000

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createPrivyBridgeState(authBaseUrl) {
  return {
    authBaseUrl,
    ready: false,
    authenticated: false,
    login: null,
    logout: null,
    getAccessToken: null,
  }
}

async function waitForPrivyReady(state, timeoutMs = PRIVY_WALLET_WAIT_MS) {
  const deadline = Date.now() + timeoutMs
  while (!state.ready && Date.now() < deadline) {
    await sleep(100)
  }
  return !!state.ready
}

async function waitForPrivyAuthenticated(state, timeoutMs = PRIVY_WALLET_WAIT_MS) {
  const deadline = Date.now() + timeoutMs
  while (!state.authenticated && Date.now() < deadline) {
    await sleep(100)
  }
  return !!state.authenticated
}

async function ensurePrivySession(state, { onStatus, allowLogin = false } = {}) {
  if (!state.authBaseUrl) {
    throw createAuthError('Wallet auth is unavailable', 404, { skipAuth: true })
  }

  const isReady = await waitForPrivyReady(state)
  if (!isReady) {
    if (allowLogin) {
      throw createAuthError('Privy is still loading', 503, { skipAuth: true })
    }
    return false
  }

  if (!state.authenticated) {
    if (!allowLogin) return false
    onStatus?.('auth', 'Opening wallet login...')
    try {
      await state.login?.()
    } catch (err) {
      throw createAuthError(err?.message || 'Wallet login was rejected', 401, { skipAuth: true })
    }
    const isAuthenticated = await waitForPrivyAuthenticated(state)
    if (!isAuthenticated) {
      throw createAuthError('Wallet login did not complete', 401, { skipAuth: true })
    }
  }

  const accessToken = await state.getAccessToken?.().catch(() => '')
  const normalizedAccessToken = typeof accessToken === 'string' ? accessToken.trim() : ''
  if (!normalizedAccessToken) {
    if (allowLogin) {
      throw createAuthError('Privy access token unavailable', 401, { skipAuth: true })
    }
    return false
  }

  await createPrivyAuthSession(state.authBaseUrl, normalizedAccessToken)
  return true
}

function createPrivyRuntimeAuthBridge(state) {
  return {
    enabled: !!state.authBaseUrl,
    mode: 'privy',
    hasWalletProvider() {
      return !!state.ready
    },
    getWalletProvider() {
      return null
    },
    normalizeSiweAddress,
    normalizeSolanaAddress,
    normalizeWalletAddressForChain,
    async connectWalletSession({ onStatus } = {}) {
      await ensurePrivySession(state, { onStatus, allowLogin: true })
      return fetchAuthMe(state.authBaseUrl).catch(() => null)
    },
    async ensureSession({ onStatus } = {}) {
      return ensurePrivySession(state, { onStatus, allowLogin: false }).catch(() => false)
    },
    async getSessionUser() {
      if (!state.authBaseUrl) return null
      return fetchAuthMe(state.authBaseUrl).catch(() => null)
    },
    async updateProfile(patch) {
      if (!state.authBaseUrl) {
        throw createAuthError('Wallet auth is unavailable', 404, { skipAuth: true })
      }
      return updateAuthProfile(state.authBaseUrl, patch)
    },
    async logoutAndClearSession() {
      if (state.authBaseUrl) {
        await logoutAuthSession(state.authBaseUrl).catch(() => {})
      }
      clearRuntimeAuthState()
      await state.logout?.().catch(() => {})
    },
    clearRuntimeAuthState,
    async getActiveWalletAddress() {
      return ''
    },
    async getActiveWalletNetwork() {
      return null
    },
    subscribeAccountChanges() {
      return () => {}
    },
  }
}

function createRuntimeWalletBridge() {
  const listeners = new Set()
  let snapshot = {
    ready: false,
    wallets: [],
  }

  const emit = () => {
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  return {
    getSnapshot() {
      return snapshot
    },
    setSnapshot(next) {
      const wallets = Array.isArray(next?.wallets) ? next.wallets : []
      const ready = !!next?.ready
      const changed =
        snapshot.ready !== ready ||
        snapshot.wallets.length !== wallets.length ||
        snapshot.wallets.some((wallet, index) => wallet !== wallets[index])
      if (!changed) return
      snapshot = { ready, wallets }
      emit()
    },
    subscribe(listener) {
      if (typeof listener !== 'function') {
        return () => {}
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function normalizePrivyWallets(wallets) {
  if (!Array.isArray(wallets)) return []
  return wallets.filter(wallet => {
    if (wallet?.type !== 'ethereum') return false
    return typeof wallet?.address === 'string' && wallet.address.trim().length > 0
  })
}

function PrivyWalletBridgeSync({ bridge, children }) {
  const { ready, wallets } = useWallets()

  useEffect(() => {
    bridge?.setSnapshot({
      ready,
      wallets: normalizePrivyWallets(wallets),
    })
  }, [bridge, ready, wallets])

  useEffect(() => {
    return () => {
      bridge?.setSnapshot({
        ready: false,
        wallets: [],
      })
    }
  }, [bridge])

  return children
}

function PrivyRuntimeAuthSync({ state, children }) {
  const { ready, authenticated, login, logout, getAccessToken } = usePrivy()

  useEffect(() => {
    state.ready = ready
    state.authenticated = authenticated
    state.login = login
    state.logout = logout
    state.getAccessToken = getAccessToken
  }, [state, ready, authenticated, login, logout, getAccessToken])

  useEffect(() => {
    if (!state.authBaseUrl || !ready) return

    let cancelled = false

    const syncSession = async () => {
      const hasSession = await fetchAuthMe(state.authBaseUrl)
        .then(() => true)
        .catch(err => {
          if (err?.status === 401) return false
          return null
        })

      if (authenticated) {
        if (hasSession !== false) return
        let restored = false
        for (let attempt = 0; attempt < 20 && !cancelled; attempt++) {
          restored = await ensurePrivySession(state, { allowLogin: false }).catch(() => false)
          if (restored) break
          await sleep(150)
        }
        if (restored && !cancelled) {
          window.location.reload()
        }
        return
      }

      if (hasSession !== true) return
      const didLogout = await logoutAuthSession(state.authBaseUrl)
        .then(() => true)
        .catch(() => false)
      if (didLogout && !cancelled) {
        window.location.reload()
      }
    }

    void syncSession()

    return () => {
      cancelled = true
    }
  }, [state, ready, authenticated])

  return children
}

const authBaseUrl = hasValue(env.PUBLIC_AUTH_URL) ? env.PUBLIC_AUTH_URL : null
const privyAppId = hasValue(env.PUBLIC_PRIVY_APP_ID) ? env.PUBLIC_PRIVY_APP_ID : ''
const privyBridgeState = privyAppId ? createPrivyBridgeState(authBaseUrl) : null
const runtimeWalletBridge = createRuntimeWalletBridge()
if (typeof globalThis !== 'undefined') {
  globalThis.__runtimeAuth = privyBridgeState
    ? createPrivyRuntimeAuthBridge(privyBridgeState)
    : createInjectedRuntimeAuthBridge(authBaseUrl)
  globalThis.__runtimeWalletBridge = runtimeWalletBridge
}

function App() {
  const [connectionStatus, setConnectionStatus] = useState(null)

  const wsUrl = useCallback(() => {
    return getConnectionUrl((status, message) => {
      setConnectionStatus({ status, message })
    })
  }, [])

  return (
    <Client
      wsUrl={wsUrl}
      connectionStatus={connectionStatus}
      apiUrl={env.PUBLIC_API_URL}
      authUrl={env.PUBLIC_AUTH_URL || null}
    />
  )
}

function RootApp() {
  if (!privyAppId || !privyBridgeState) {
    return <App />
  }
  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        supportedChains: [DEFAULT_EVM_CHAIN],
        defaultChain: DEFAULT_EVM_CHAIN,
        appearance: {
          walletChainType: 'ethereum-and-solana',
        },
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors(),
          },
        },
        embeddedWallets: {
          ethereum: { createOnLogin: 'all-users' },
          solana: { createOnLogin: 'all-users' },
        },
      }}
    >
      <PrivyWalletBridgeSync bridge={runtimeWalletBridge}>
        <PrivyRuntimeAuthSync state={privyBridgeState}>
          <App />
        </PrivyRuntimeAuthSync>
      </PrivyWalletBridgeSync>
    </PrivyProvider>
  )
}

const root = createRoot(document.getElementById('root'))
root.render(<RootApp />)
