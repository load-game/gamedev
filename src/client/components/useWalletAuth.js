import { useEffect, useRef, useState } from 'react'
import { storage } from '../../core/storage'

const defaultWalletAuthState = {
  enabled: false,
  mode: null,
  providerAvailable: false,
  providerAvailability: {
    ethereum: false,
    solana: false,
  },
  connected: false,
  pending: false,
  address: null,
  wallet: null,
}

const PRIVY_SIWE_RESUME_KEY = 'privySiweResume'
const PRIVY_SIWE_RESUME_TTL_MS = 10 * 60 * 1000
const PRIVY_PROVIDER_WAIT_MS = 10000

function setPrivySiweResumeIntent() {
  try {
    storage.set(PRIVY_SIWE_RESUME_KEY, { ts: Date.now() })
  } catch {
    // ignore storage access failures
  }
}

function clearPrivySiweResumeIntent() {
  try {
    storage.remove(PRIVY_SIWE_RESUME_KEY)
  } catch {
    // ignore storage access failures
  }
}

function hasPrivySiweResumeIntent() {
  try {
    const value = storage.get(PRIVY_SIWE_RESUME_KEY)
    if (!value || typeof value !== 'object') return false
    const ts = Number(value.ts)
    if (!Number.isFinite(ts) || ts <= 0 || Date.now() - ts > PRIVY_SIWE_RESUME_TTL_MS) {
      storage.remove(PRIVY_SIWE_RESUME_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

function resolveProviderAvailability(auth) {
  const hasProvider = typeof auth?.hasWalletProvider === 'function' ? auth.hasWalletProvider.bind(auth) : null
  const ethereum = !!(hasProvider?.('ethereum') || hasProvider?.())
  const solana = !!hasProvider?.('solana')
  return {
    ethereum,
    solana,
    any: !!(hasProvider?.('any') || ethereum || solana),
  }
}

function normalizeWalletType(value) {
  if (value === 'solana') return 'solana'
  if (value === 'ethereum') return 'ethereum'
  return ''
}

function normalizeSolanaNetwork(value) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().toLowerCase()
  if (!normalized) return ''
  if (normalized.includes('devnet')) return 'devnet'
  if (normalized.includes('mainnet')) return 'mainnet'
  return ''
}

function normalizeAddressForChain(auth, chain, address) {
  if (chain === 'solana') {
    return (
      auth.normalizeWalletAddressForChain?.('solana', address || '') ||
      auth.normalizeSolanaAddress?.(address || '') ||
      ''
    )
  }
  return (
    auth.normalizeWalletAddressForChain?.('ethereum', address || '') ||
    auth.normalizeSiweAddress?.(address || '') ||
    ''
  )
}

function resolveSessionWallet(session, auth) {
  const walletRow = session?.user?.wallet
  if (walletRow && typeof walletRow === 'object') {
    const type = normalizeWalletType(walletRow.type)
    const normalizedAddress = type
      ? normalizeAddressForChain(auth, type, walletRow.address)
      : ''
    if (type && normalizedAddress) {
      return {
        type,
        address: normalizedAddress,
        chainId: type === 'ethereum' && typeof walletRow.chain_id === 'number' ? walletRow.chain_id : null,
        solanaNetwork: type === 'solana' ? normalizeSolanaNetwork(walletRow.solana_network) : '',
      }
    }
  }

  const fallbackAddress = normalizeAddressForChain(auth, 'ethereum', session?.user?.wallet_address || '')
  if (!fallbackAddress) {
    return {
      type: '',
      address: '',
      chainId: null,
      solanaNetwork: '',
    }
  }
  return {
    type: 'ethereum',
    address: fallbackAddress,
    chainId: null,
    solanaNetwork: '',
  }
}

function matchesWalletAddress(chain, expectedAddress, nextAddress) {
  if (chain === 'ethereum') {
    return expectedAddress.toLowerCase() === nextAddress.toLowerCase()
  }
  return expectedAddress === nextAddress
}

export function useWalletAuth(world) {
  const [walletAuth, setWalletAuth] = useState(defaultWalletAuthState)
  const sessionWalletRef = useRef({
    type: '',
    address: '',
    chainId: null,
    solanaNetwork: '',
  })
  const walletMismatchRef = useRef(false)

  useEffect(() => {
    const auth = globalThis.__runtimeAuth
    if (!auth?.enabled) {
      setWalletAuth(defaultWalletAuthState)
      sessionWalletRef.current = {
        type: '',
        address: '',
        chainId: null,
        solanaNetwork: '',
      }
      walletMismatchRef.current = false
      return
    }

    let cancelled = false
    let removeAccountSubscription = null
    let verifyTimerId = null

    const setAuthState = patch => {
      if (cancelled) return
      setWalletAuth(prev => ({ ...prev, ...patch }))
    }

    const kickForWalletChange = async reason => {
      if (cancelled || walletMismatchRef.current) return
      walletMismatchRef.current = true
      setAuthState({ connected: false, address: null, wallet: null })
      await auth.logoutAndClearSession?.().catch(() => {})
      if (cancelled) return
      world.emit('kick', reason)
      world.network?.destroy?.()
      setTimeout(() => {
        window.location.reload()
      }, 150)
    }

    const handleWalletAddressChange = nextValue => {
      if (auth.mode === 'privy') return
      const expectedWallet = sessionWalletRef.current
      const expectedAddress = expectedWallet.address
      if (!expectedAddress) return
      const expectedChain = expectedWallet.type || 'ethereum'
      const nextAddress = normalizeAddressForChain(auth, expectedChain, nextValue || '')
      if (!nextAddress) {
        void kickForWalletChange('wallet_disconnected')
        return
      }
      if (!matchesWalletAddress(expectedChain, expectedAddress, nextAddress)) {
        void kickForWalletChange('wallet_changed')
      }
    }

    const verifyActiveWallet = async () => {
      const expectedWallet = sessionWalletRef.current
      const expectedAddress = expectedWallet.address
      const expectedChain = expectedWallet.type || 'ethereum'
      const availability = resolveProviderAvailability(auth)
      const providerAvailable = expectedAddress
        ? (expectedChain === 'solana' ? availability.solana : availability.ethereum)
        : availability.any
      setAuthState({
        enabled: true,
        mode: auth.mode || null,
        providerAvailable,
        providerAvailability: {
          ethereum: availability.ethereum,
          solana: availability.solana,
        },
      })
      if (!expectedAddress) return
      if (auth.mode === 'privy') return

      if (!providerAvailable) {
        if (auth.mode === 'injected') {
          await kickForWalletChange('wallet_disconnected')
        }
        return
      }

      const activeAddress = normalizeAddressForChain(
        auth,
        expectedChain,
        await auth.getActiveWalletAddress?.({ chain: expectedChain }).catch(() => ''),
      )
      if (!activeAddress) {
        await kickForWalletChange('wallet_disconnected')
        return
      }
      if (!matchesWalletAddress(expectedChain, expectedAddress, activeAddress)) {
        await kickForWalletChange('wallet_changed')
        return
      }

      if (expectedChain === 'solana' && expectedWallet.solanaNetwork) {
        const activeNetwork = normalizeSolanaNetwork(
          await auth.getActiveWalletNetwork?.({ chain: 'solana' }).catch(() => ''),
        )
        if (activeNetwork && activeNetwork !== expectedWallet.solanaNetwork) {
          await kickForWalletChange('wallet_network_changed')
        }
      }
    }

    const initWalletAuth = async () => {
      const availability = resolveProviderAvailability(auth)
      setAuthState({
        enabled: true,
        mode: auth.mode || null,
        providerAvailable: availability.any,
        providerAvailability: {
          ethereum: availability.ethereum,
          solana: availability.solana,
        },
      })

      const session = await auth.getSessionUser?.().catch(() => null)
      const sessionUserId = typeof session?.user?.id === 'string' ? session.user.id.trim() : ''
      const sessionWallet = resolveSessionWallet(session, auth)
      sessionWalletRef.current = sessionWallet
      setAuthState({
        connected: !!sessionUserId,
        address: sessionWallet.address || null,
        wallet: sessionWallet.address
          ? {
              type: sessionWallet.type || 'ethereum',
              address: sessionWallet.address,
              ...(typeof sessionWallet.chainId === 'number' ? { chain_id: sessionWallet.chainId } : null),
              ...(sessionWallet.solanaNetwork ? { solana_network: sessionWallet.solanaNetwork } : null),
            }
          : null,
      })

      const shouldResumePrivySiwe = auth.mode === 'privy' && !sessionUserId && hasPrivySiweResumeIntent()
      if (shouldResumePrivySiwe) {
        setAuthState({ pending: true })
        try {
          const deadline = Date.now() + PRIVY_PROVIDER_WAIT_MS
          while (!cancelled && Date.now() < deadline) {
            if (auth.hasWalletProvider?.()) break
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          if (cancelled) return
          if (auth.hasWalletProvider?.()) {
            await auth.connectWalletSession?.()
            clearPrivySiweResumeIntent()
            if (!cancelled) {
              window.location.reload()
              return
            }
          } else {
            clearPrivySiweResumeIntent()
          }
        } catch (err) {
          clearPrivySiweResumeIntent()
          if (!err?.skipAuth) {
            world.emit('toast', err?.message || 'Wallet login failed')
          }
        } finally {
          setAuthState({ pending: false })
        }
      } else if (sessionUserId || auth.mode !== 'privy') {
        clearPrivySiweResumeIntent()
      }

      removeAccountSubscription = auth.subscribeAccountChanges?.(
        handleWalletAddressChange,
        sessionWallet.address ? { chain: sessionWallet.type || 'ethereum' } : undefined,
      ) || null
      await verifyActiveWallet()
      verifyTimerId = setInterval(() => {
        void verifyActiveWallet()
      }, 3000)
    }

    initWalletAuth()

    return () => {
      cancelled = true
      removeAccountSubscription?.()
      if (verifyTimerId) {
        clearInterval(verifyTimerId)
      }
    }
  }, [world])

  const connectWallet = async (options = {}) => {
    const auth = globalThis.__runtimeAuth
    if (!auth?.enabled) return
    if (walletAuth.pending || walletAuth.connected) return
    const shouldResumePrivySiwe = auth.mode === 'privy'
    if (shouldResumePrivySiwe) {
      setPrivySiweResumeIntent()
    }
    setWalletAuth(prev => ({ ...prev, pending: true }))
    try {
      await auth.connectWalletSession?.(options)
      if (shouldResumePrivySiwe) {
        clearPrivySiweResumeIntent()
      }
      window.location.reload()
    } catch (err) {
      if (shouldResumePrivySiwe) {
        clearPrivySiweResumeIntent()
      }
      if (!err?.skipAuth) {
        world.emit('toast', err?.message || 'Wallet login failed')
      }
    } finally {
      setWalletAuth(prev => ({ ...prev, pending: false }))
    }
  }

  const disconnectWallet = async () => {
    const auth = globalThis.__runtimeAuth
    if (!auth?.enabled) return
    if (walletAuth.pending) return
    clearPrivySiweResumeIntent()
    setWalletAuth(prev => ({ ...prev, pending: true }))
    try {
      await auth.logoutAndClearSession?.()
    } catch {
      // always reload to force a clean guest state
    } finally {
      window.location.reload()
    }
  }

  return {
    walletAuth,
    connectWallet,
    disconnectWallet,
  }
}
