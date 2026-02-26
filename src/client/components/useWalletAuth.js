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

export function useWalletAuth(world) {
  const [walletAuth, setWalletAuth] = useState(defaultWalletAuthState)
  const sessionWalletRef = useRef('')
  const walletMismatchRef = useRef(false)

  useEffect(() => {
    const auth = globalThis.__runtimeAuth
    if (!auth?.enabled) {
      setWalletAuth(defaultWalletAuthState)
      sessionWalletRef.current = ''
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
      setAuthState({ connected: false, address: null })
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
      const expectedAddress = sessionWalletRef.current
      if (!expectedAddress) return
      const nextAddress = auth.normalizeSiweAddress?.(nextValue || '') || ''
      if (!nextAddress) {
        void kickForWalletChange('wallet_disconnected')
        return
      }
      if (nextAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
        void kickForWalletChange('wallet_changed')
      }
    }

    const verifyActiveWallet = async () => {
      const expectedAddress = sessionWalletRef.current
      const availability = resolveProviderAvailability(auth)
      const providerAvailable = availability.any
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

      const activeAddress = auth.normalizeSiweAddress?.(await auth.getActiveWalletAddress?.().catch(() => '')) || ''
      if (!activeAddress) {
        await kickForWalletChange('wallet_disconnected')
        return
      }
      if (activeAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
        await kickForWalletChange('wallet_changed')
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
      const sessionAddress = auth.normalizeSiweAddress?.(session?.user?.wallet_address || '') || ''
      sessionWalletRef.current = sessionAddress
      setAuthState({
        connected: !!sessionUserId,
        address: sessionAddress || null,
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

      removeAccountSubscription = auth.subscribeAccountChanges?.(handleWalletAddressChange) || null
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
