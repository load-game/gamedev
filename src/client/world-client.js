// import 'ses'
// import '../core/lockdown'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { css } from '@firebolt-dev/css'
import { getWallets } from '@wallet-standard/app'
import { useActiveWallet } from '@privy-io/react-auth'
import { useStandardWallets, useWallets as useSolanaWallets } from '@privy-io/react-auth/solana'

import { createClientWorld } from '../core/createClientWorld'
import { CoreUI } from './components/CoreUI'
import { assetPath } from './utils'
import { EditorLayout } from './components/editor/EditorLayout'
import { createRuntimeWalletAdapter } from './wallet-adapter'

export { System } from '../core/systems/System'

const STANDARD_CONNECT_FEATURE = 'standard:connect'
const STANDARD_DISCONNECT_FEATURE = 'standard:disconnect'
const STANDARD_EVENTS_FEATURE = 'standard:events'
const SOLANA_SIGN_MESSAGE_FEATURE = 'solana:signMessage'
const SOLANA_SIGN_TRANSACTION_FEATURE = 'solana:signTransaction'

function normalizeSolanaAddress(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
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

function sameSolanaWallet(a, b) {
  return normalizeSolanaAddress(a) === normalizeSolanaAddress(b)
}

function resolveSolanaCluster(chain) {
  if (typeof chain !== 'string') return 'mainnet'
  if (chain.includes('devnet')) return 'devnet'
  if (chain.includes('testnet')) return 'testnet'
  return 'mainnet'
}

function getSolanaWalletStandardRegistry() {
  return getWallets()
}

function isSolanaWalletStandardWallet(wallet) {
  if (!wallet || typeof wallet !== 'object') return false
  if (!Array.isArray(wallet.chains) || !wallet.chains.some(chain => typeof chain === 'string' && chain.startsWith('solana:'))) {
    return false
  }
  return !!(
    wallet.features?.[STANDARD_CONNECT_FEATURE]?.connect &&
    wallet.features?.[SOLANA_SIGN_MESSAGE_FEATURE]?.signMessage &&
    wallet.features?.[SOLANA_SIGN_TRANSACTION_FEATURE]?.signTransaction
  )
}

function getSolanaWalletStandardAccount(wallet) {
  if (!isSolanaWalletStandardWallet(wallet)) return null
  const accounts = Array.isArray(wallet.accounts) ? wallet.accounts : []
  return (
    accounts.find(account => typeof account?.address === 'string' && account.address) ||
    accounts[0] ||
    null
  )
}

function getSolanaWalletStandardChain(wallet) {
  const account = getSolanaWalletStandardAccount(wallet)
  const accountChain = Array.isArray(account?.chains) ? account.chains.find(chain => typeof chain === 'string') : null
  if (accountChain) return accountChain
  if (Array.isArray(wallet?.chains)) {
    return wallet.chains.find(chain => typeof chain === 'string' && chain.startsWith('solana:')) || 'solana:mainnet'
  }
  return 'solana:mainnet'
}

function getSolanaWalletStandardAddress(wallet) {
  return normalizeSolanaAddress(getSolanaWalletStandardAccount(wallet)?.address)
}

function buildSolanaWalletStandardBinding(wallet, { source = 'wallet-standard' } = {}) {
  if (!isSolanaWalletStandardWallet(wallet)) return null
  const chain = getSolanaWalletStandardChain(wallet)
  const cluster = resolveSolanaCluster(chain)
  const getAddress = () => getSolanaWalletStandardAddress(wallet) || null
  const isConnected = () => !!getSolanaWalletStandardAccount(wallet)
  return {
    binding: {
      address: getAddress(),
      connected: isConnected(),
      cluster,
      getAddress,
      isConnected,
      connect: async () => {
        const connectFeature = wallet.features?.[STANDARD_CONNECT_FEATURE]
        if (!connectFeature?.connect) {
          throw new Error('No Solana wallet is available')
        }
        await connectFeature.connect()
      },
      disconnect: async () => {
        const disconnectFeature = wallet.features?.[STANDARD_DISCONNECT_FEATURE]
        await disconnectFeature?.disconnect?.()
      },
      signMessage: async message => {
        const account = getSolanaWalletStandardAccount(wallet)
        if (!account) {
          throw new Error('Solana wallet not connected')
        }
        const signMessageFeature = wallet.features?.[SOLANA_SIGN_MESSAGE_FEATURE]
        if (!signMessageFeature?.signMessage) {
          throw new Error('Solana wallet cannot sign messages')
        }
        const [result] = await signMessageFeature.signMessage({
          account,
          message: toUint8Array(message) || new Uint8Array(),
        })
        return result?.signature || null
      },
      signTransaction: async transaction => {
        const account = getSolanaWalletStandardAccount(wallet)
        if (!account) {
          throw new Error('Solana wallet not connected')
        }
        const signTransactionFeature = wallet.features?.[SOLANA_SIGN_TRANSACTION_FEATURE]
        if (!signTransactionFeature?.signTransaction) {
          throw new Error('Solana wallet cannot sign transactions')
        }
        const [result] = await signTransactionFeature.signTransaction({
          account,
          transaction: toUint8Array(transaction) || new Uint8Array(),
          chain,
        })
        return result?.signedTransaction || null
      },
    },
    snapshot: {
      source,
      address: getAddress(),
      connected: isConnected(),
      available: true,
      cluster,
    },
  }
}

function getInjectedSolanaProviderCandidates() {
  if (typeof window === 'undefined') return []
  const seen = new Set()
  const providers = []
  const candidates = [
    window.solana,
    window.phantom?.solana,
    window.backpack?.solana,
    window.backpack,
    window.solflare,
    window.solflare?.solana,
    window.glowSolana,
    window.glow?.solana,
  ]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || seen.has(candidate)) continue
    seen.add(candidate)
    providers.push(candidate)
  }
  return providers
}

function readInjectedSolanaAddress(provider) {
  if (isSolanaWalletStandardWallet(provider)) {
    return getSolanaWalletStandardAddress(provider)
  }
  const value = provider?.publicKey?.toBase58?.() || provider?.publicKey?.toString?.() || provider?.publicKey
  return normalizeSolanaAddress(value)
}

function resolveInjectedSolanaCluster(provider) {
  if (isSolanaWalletStandardWallet(provider)) {
    return resolveSolanaCluster(getSolanaWalletStandardChain(provider))
  }
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
    if (normalized.includes('testnet')) return 'testnet'
    if (normalized.includes('mainnet')) return 'mainnet'
  }
  return 'mainnet'
}

function isInjectedSolanaProvider(provider) {
  if (!provider || typeof provider !== 'object') return false
  if (isSolanaWalletStandardWallet(provider)) return true
  return typeof provider.connect === 'function' && typeof provider.signMessage === 'function'
}

function buildInjectedSolanaBinding(provider) {
  if (!isInjectedSolanaProvider(provider)) return null
  const standardBinding = buildSolanaWalletStandardBinding(provider, { source: 'injected' })
  if (standardBinding) return standardBinding
  const getAddress = () => readInjectedSolanaAddress(provider) || null
  const isConnected = () => !!(provider?.isConnected || getAddress())
  const cluster = resolveInjectedSolanaCluster(provider)
  return {
    binding: {
      address: getAddress(),
      connected: isConnected(),
      cluster,
      getAddress,
      isConnected,
      connect: async () => {
        if (typeof provider.connect !== 'function') {
          throw new Error('No Solana wallet is available')
        }
        await provider.connect()
      },
      disconnect: async () => {
        await provider.disconnect?.()
      },
      signMessage: async message => {
        if (typeof provider.signMessage !== 'function') {
          throw new Error('Solana wallet cannot sign messages')
        }
        const result = await provider.signMessage(toUint8Array(message) || new Uint8Array())
        return result?.signature || result || null
      },
      signTransaction: async transaction => {
        if (typeof provider.signTransaction !== 'function') {
          throw new Error('Solana wallet cannot sign transactions')
        }
        const result = await provider.signTransaction(toUint8Array(transaction) || new Uint8Array())
        return result?.signedTransaction || result?.transaction || result || null
      },
    },
    snapshot: {
      source: 'injected',
      address: getAddress(),
      connected: isConnected(),
      available: true,
      cluster,
    },
  }
}

function resolveInjectedSolanaWallet(_version = 0) {
  const registry = getSolanaWalletStandardRegistry()
  const standardWallets = registry.get().filter(isSolanaWalletStandardWallet)
  const standardWallet =
    standardWallets.find(wallet => getSolanaWalletStandardAccount(wallet)) || standardWallets[0] || null
  const standardBinding = buildSolanaWalletStandardBinding(standardWallet)
  if (standardBinding) return standardBinding

  const injectedProviders = getInjectedSolanaProviderCandidates().filter(isInjectedSolanaProvider)
  const injectedProvider =
    injectedProviders.find(provider => readInjectedSolanaAddress(provider) || provider?.isConnected) ||
    injectedProviders[0] ||
    null
  return buildInjectedSolanaBinding(injectedProvider)
}

function publishRuntimeSolanaWalletSnapshot(snapshot) {
  if (typeof globalThis === 'undefined') return
  const normalized = {
    source: snapshot?.source || null,
    address: snapshot?.address || null,
    connected: !!snapshot?.connected,
    available: !!snapshot?.available,
    cluster: snapshot?.cluster || 'mainnet',
    updatedAt: Date.now(),
  }
  globalThis.__runtimeResolvedSolanaWallet = normalized
  if (
    typeof window !== 'undefined' &&
    typeof window.dispatchEvent === 'function' &&
    typeof window.CustomEvent === 'function'
  ) {
    window.dispatchEvent(new window.CustomEvent('runtime-solana-wallet-snapshot', { detail: normalized }))
  }
}

function PrivySolanaWalletBridge({ world }) {
  const { wallet: activePrivyWallet } = useActiveWallet()
  const { wallets: connectedSolanaWallets = [] } = useSolanaWallets()
  const { wallets: standardSolanaWallets = [] } = useStandardWallets()

  useEffect(() => {
    const activeWallet =
      activePrivyWallet?.type === 'solana'
        ? connectedSolanaWallets.find(wallet => sameSolanaWallet(wallet.address, activePrivyWallet.address)) ||
          connectedSolanaWallets[0] ||
          null
        : connectedSolanaWallets[0] || null

    const standardWallet = activeWallet?.standardWallet || standardSolanaWallets[0] || null
    const chain = activeWallet?.standardWallet?.chains?.[0] || standardWallet?.chains?.[0] || 'solana:mainnet'
    const cluster = resolveSolanaCluster(chain)

    const binding =
      standardWallet || activeWallet
        ? {
            address: activeWallet?.address || null,
            connected: !!activeWallet,
            cluster,
            getAddress: () => activeWallet?.address || null,
            isConnected: () => !!activeWallet,
            connect: async () => {
              const connectFeature = standardWallet?.features?.['standard:connect']
              if (!connectFeature?.connect) {
                throw new Error('No Solana wallet is available')
              }
              await connectFeature.connect()
            },
            disconnect: async () => {
              if (activeWallet) {
                await activeWallet.disconnect()
                return
              }
              const disconnectFeature = standardWallet?.features?.['standard:disconnect']
              await disconnectFeature?.disconnect?.()
            },
            signMessage: async message => {
              if (!activeWallet) {
                throw new Error('Solana wallet not connected')
              }
              const result = await activeWallet.signMessage({ message })
              return result?.signature || null
            },
            signTransaction: async transaction => {
              if (!activeWallet) {
                throw new Error('Solana wallet not connected')
              }
              const result = await activeWallet.signTransaction({
                transaction,
                chain,
              })
              return result?.signedTransaction || null
            },
          }
        : null

    world.solana?.bind?.(binding)
    publishRuntimeSolanaWalletSnapshot({
      source: 'privy',
      address: activeWallet?.address || null,
      connected: !!activeWallet,
      available: !!standardWallet,
      cluster,
    })
  }, [world, activePrivyWallet, connectedSolanaWallets, standardSolanaWallets])

  useEffect(() => {
    return () => {
      world.solana?.bind?.(null)
      publishRuntimeSolanaWalletSnapshot({
        source: 'privy',
        address: null,
        connected: false,
        available: false,
        cluster: 'mainnet',
      })
    }
  }, [world])

  return null
}

function InjectedSolanaWalletBridge({ world }) {
  const [walletVersion, setWalletVersion] = useState(0)
  const resolvedWallet = useMemo(() => resolveInjectedSolanaWallet(walletVersion), [walletVersion])

  useEffect(() => {
    if (typeof window === 'undefined') return () => {}

    const notify = () => {
      setWalletVersion(current => current + 1)
    }

    const registry = getSolanaWalletStandardRegistry()
    const offRegister = registry.on('register', notify)
    const offUnregister = registry.on('unregister', notify)

    const walletUnsubscribers = registry
      .get()
      .map(wallet => wallet.features?.[STANDARD_EVENTS_FEATURE]?.on?.('change', notify))
      .filter(unsubscribe => typeof unsubscribe === 'function')

    const providerUnsubscribers = getInjectedSolanaProviderCandidates().map(provider => {
      if (typeof provider?.on !== 'function') return null
      provider.on('connect', notify)
      provider.on('disconnect', notify)
      provider.on('accountChanged', notify)
      return () => {
        provider.removeListener?.('connect', notify)
        provider.removeListener?.('disconnect', notify)
        provider.removeListener?.('accountChanged', notify)
      }
    })

    window.addEventListener('solana#initialized', notify)

    return () => {
      offRegister?.()
      offUnregister?.()
      for (const unsubscribe of walletUnsubscribers) {
        unsubscribe?.()
      }
      for (const unsubscribe of providerUnsubscribers) {
        unsubscribe?.()
      }
      window.removeEventListener('solana#initialized', notify)
    }
  }, [walletVersion])

  useEffect(() => {
    world.solana?.bind?.(resolvedWallet?.binding || null)
    publishRuntimeSolanaWalletSnapshot(
      resolvedWallet?.snapshot || {
        source: 'injected',
        address: null,
        connected: false,
        available: false,
        cluster: 'mainnet',
      }
    )
  }, [world, resolvedWallet])

  useEffect(() => {
    return () => {
      world.solana?.bind?.(null)
      publishRuntimeSolanaWalletSnapshot({
        source: 'injected',
        address: null,
        connected: false,
        available: false,
        cluster: 'mainnet',
      })
    }
  }, [world])

  return null
}

export function Client({ wsUrl, apiUrl, authUrl, connectionStatus, onSetup }) {
  const viewportRef = useRef()
  const cssLayerRef = useRef()
  const uiRef = useRef()
  const world = useMemo(() => createClientWorld(), [])
  const walletAdapter = useMemo(() => createRuntimeWalletAdapter(), [])
  const shouldUsePrivySolanaBridge = typeof globalThis !== 'undefined' && globalThis.__runtimeAuth?.mode === 'privy'
  const [ui, setUI] = useState(world.ui.state)
  const [resolvedWsUrl, setResolvedWsUrl] = useState(null)
  const [apiBaseUrl, setApiBaseUrl] = useState(null)
  const [authBaseUrl, setAuthBaseUrl] = useState(null)
  const [entered] = useState(true)
  useEffect(() => {
    world.on('ui', setUI)
    return () => {
      world.off('ui', setUI)
    }
  }, [])
  useEffect(() => {
    let cancelled = false
    const resolve = async () => {
      try {
        let finalWsUrl = wsUrl
        if (typeof finalWsUrl === 'function') {
          finalWsUrl = finalWsUrl()
          if (finalWsUrl instanceof Promise) finalWsUrl = await finalWsUrl
        }
        if (cancelled) return
        setResolvedWsUrl(finalWsUrl)
        const derivedHttpUrl = finalWsUrl.replace(/^ws/, 'http').replace(/\/ws.*$/, '')
        setApiBaseUrl(apiUrl || derivedHttpUrl)
        const cleanedAuthUrl = typeof authUrl === 'string' ? authUrl.trim() : authUrl
        setAuthBaseUrl(cleanedAuthUrl)
      } catch (err) {
        console.error('Failed to resolve connection:', err)
      }
    }
    resolve()
    return () => {
      cancelled = true
    }
  }, [wsUrl, apiUrl, authUrl])

  useEffect(() => {
    const publishRuntimeWalletSnapshot = snapshot => {
      if (typeof globalThis === 'undefined') return
      const normalized = {
        source: snapshot?.source || null,
        address: snapshot?.address || null,
        connected: !!snapshot?.connected,
        chainId: snapshot?.chainId ?? null,
        updatedAt: Date.now(),
      }
      globalThis.__runtimeResolvedWallet = normalized
      if (
        typeof window !== 'undefined' &&
        typeof window.dispatchEvent === 'function' &&
        typeof window.CustomEvent === 'function'
      ) {
        window.dispatchEvent(new window.CustomEvent('runtime-wallet-snapshot', { detail: normalized }))
      }
    }

    const applyWalletBinding = snapshot => {
      publishRuntimeWalletSnapshot(snapshot)
      const binding = {
        walletAdapter,
        address: snapshot?.address || null,
        isConnected: !!snapshot?.connected,
      }
      world.evm?.bind?.(binding)
      world.hyperliquid?.bind?.(binding)
    }

    applyWalletBinding(walletAdapter.getSnapshot())
    const unsubscribe = walletAdapter.subscribe(snapshot => {
      applyWalletBinding(snapshot)
    })
    void walletAdapter.refresh().then(applyWalletBinding).catch(() => {})

    return () => {
      unsubscribe?.()
    }
  }, [world, walletAdapter])

  useEffect(() => {
    return () => {
      walletAdapter.destroy()
    }
  }, [walletAdapter])

  useEffect(() => {
    if (!entered) return
    if (!resolvedWsUrl) return
    const init = async () => {
      const viewport = viewportRef.current
      const cssLayer = cssLayerRef.current
      const ui = uiRef.current
      const baseEnvironment = {
        model: assetPath('/base-environment.glb'),
        bg: null, // '/day2-2k.jpg',
        hdr: assetPath('/Clear_08_4pm_LDR.hdr'),
        rotationY: 0,
        sunDirection: new THREE.Vector3(-1, -2, -2).normalize(),
        sunIntensity: 1,
        sunColor: 0xffffff,
        fogNear: null,
        fogFar: null,
        fogColor: null,
      }
      const config = { viewport, cssLayer, ui, wsUrl: resolvedWsUrl, baseEnvironment, apiUrl: apiBaseUrl, authUrl: authBaseUrl }
      onSetup?.(world, config)
      world.init(config)
    }
    init()
  }, [entered, resolvedWsUrl, apiBaseUrl, authBaseUrl])
  return (
    <div
      className='App'
      css={css`
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 100vh;
        height: 100dvh;
        .App__viewport {
          position: relative;
          overflow: hidden;
          min-width: 0;
          min-height: 0;
          width: 100%;
          height: 100%;
        }
        .App__cssLayer {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .App__ui {
          position: absolute;
          inset: 0;
          z-index: 10;
          pointer-events: none;
          user-select: none;
          display: ${ui.visible ? 'block' : 'none'};
        }
      `}
    >
      {shouldUsePrivySolanaBridge ? <PrivySolanaWalletBridge world={world} /> : <InjectedSolanaWalletBridge world={world} />}
      <EditorLayout world={world} ui={ui}>
        <div className='App__viewport' ref={viewportRef}>
          <div className='App__cssLayer' ref={cssLayerRef} />
        </div>
      </EditorLayout>
      <div className='App__ui' ref={uiRef}>
        <CoreUI world={world} connectionStatus={connectionStatus} />
      </div>
    </div>
  )
}
