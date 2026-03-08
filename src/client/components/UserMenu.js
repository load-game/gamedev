import { css } from '@firebolt-dev/css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LoaderIcon, LogOutIcon, UserIcon, XIcon } from 'lucide-react'
import { useActiveWallet, useLinkAccount, useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { editorTheme as theme } from './editor/editorTheme'
import { cls } from './cls'

const WORLD_SLUG_REGEX = /^[a-z0-9-]+$/

const PRIVY_METHOD_LABELS = {
  email: 'Email',
  phone: 'Phone',
  wallet: 'Wallet',
  google: 'Google',
  google_oauth: 'Google',
  twitter: 'Twitter / X',
  twitter_oauth: 'Twitter / X',
  discord: 'Discord',
  discord_oauth: 'Discord',
  github: 'Github',
  github_oauth: 'Github',
  custom: 'Custom',
}

function resolveWorldServiceApiBase() {
  const configuredAuthUrl = typeof globalThis?.env?.PUBLIC_AUTH_URL === 'string' ? globalThis.env.PUBLIC_AUTH_URL.trim() : ''
  if (configuredAuthUrl) {
    return configuredAuthUrl.replace(/\/+$/, '').replace(/\/identity$/, '')
  }
  return 'https://dev.lobby.ws'
}

function getErrorMessage(body, fallback) {
  const message = typeof body?.message === 'string' ? body.message : ''
  if (message) return message
  const error = typeof body?.error === 'string' ? body.error : ''
  if (error) return error
  return fallback
}

function slugify(value) {
  if (typeof value !== 'string') return ''
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

async function requestJson(url, options = {}) {
  const hasBody = typeof options.body === 'string'
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(hasBody ? { 'content-type': 'application/json' } : null),
      ...(options.headers || null),
    },
    ...options,
  })
  const body = await response.json().catch(() => null)
  return { ok: response.ok, status: response.status, body }
}

function toPrivyErrorMessage(error, fallback) {
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object' && typeof error.message === 'string' && error.message.trim()) {
    return error.message
  }
  return fallback
}

function hasLinkedAccountType(user, linkedType) {
  if (!user || typeof user !== 'object') return false
  const linkedAccounts = Array.isArray(user.linkedAccounts) ? user.linkedAccounts : []
  return linkedAccounts.some(account => account?.type === linkedType)
}

function humanizePrivyMethod(method, fallback = 'Account') {
  if (typeof method !== 'string') return fallback
  const normalized = method.trim().toLowerCase()
  if (!normalized) return fallback
  return PRIVY_METHOD_LABELS[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function getDisplayName(user) {
  return (
    user?.google?.name ||
    user?.twitter?.name ||
    user?.discord?.username ||
    user?.github?.name ||
    user?.github?.username ||
    user?.email?.address ||
    'Privy user'
  )
}

function getPrimaryEmail(user) {
  return (
    user?.email?.address ||
    user?.google?.email ||
    user?.discord?.email ||
    user?.github?.email ||
    null
  )
}

function truncateAddress(address) {
  if (typeof address !== 'string' || !address) return ''
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatBalance(value, maximumFractionDigits = 6) {
  if (!Number.isFinite(value)) return '--'
  return value.toLocaleString('en-US', { maximumFractionDigits })
}

function getWalletChainLabel(chainType) {
  if (chainType === 'ethereum') return 'EVM'
  if (chainType === 'solana') return 'Solana'
  if (typeof chainType === 'string' && chainType) return chainType
  return 'Wallet'
}

function getSolanaClusterLabel(cluster) {
  if (cluster === 'devnet') return 'Devnet'
  if (cluster === 'testnet') return 'Testnet'
  return 'Mainnet'
}

function getSolanaExplorerUrl(signature, cluster) {
  if (typeof signature !== 'string' || !signature.trim()) return ''
  const url = new URL(`https://explorer.solana.com/tx/${signature.trim()}`)
  if (cluster === 'devnet' || cluster === 'testnet') {
    url.searchParams.set('cluster', cluster)
  }
  return url.toString()
}

function getSolanaTransferStatusLabel(status) {
  if (status === 'pending') return 'Pending'
  if (status === 'signed') return 'Signed'
  if (status === 'confirmed') return 'Confirmed'
  if (status === 'failed') return 'Failed'
  return 'Idle'
}

function getSolanaTransferStatusMessage(operation) {
  if (!operation) return ''
  if (operation.status === 'pending') return 'Waiting for wallet approval.'
  if (operation.status === 'signed') return 'Signed in wallet. Awaiting confirmation.'
  if (operation.status === 'confirmed') return 'Transaction confirmed on Solana.'
  if (operation.status === 'failed') return operation.error || 'Transaction failed.'
  return ''
}

async function copyToClipboard(text) {
  const value = typeof text === 'string' ? text.trim() : ''
  if (!value) return false

  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // fall through to legacy clipboard path
    }
  }

  if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.top = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(textarea)
      return copied
    } catch {
      return false
    }
  }

  return false
}

function normalizeWalletAddress(address, chainType) {
  if (typeof address !== 'string') return ''
  const trimmed = address.trim()
  if (!trimmed) return ''
  if (chainType === 'ethereum') return trimmed.toLowerCase()
  return trimmed
}

function sameWalletAddress(a, b, chainType) {
  const normalizedA = normalizeWalletAddress(a, chainType)
  const normalizedB = normalizeWalletAddress(b, chainType)
  if (!normalizedA || !normalizedB) return false
  return normalizedA === normalizedB
}

function getLatestConnectedWallet(wallets) {
  if (!Array.isArray(wallets) || wallets.length === 0) return null
  return wallets
    .slice()
    .sort((a, b) => {
      const aTime = Number(a?.connectedAt) || 0
      const bTime = Number(b?.connectedAt) || 0
      return bTime - aTime
    })[0]
}

function PrivyAccountSection({ world, onDisconnectWallet, children }) {
  const [signingOut, setSigningOut] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [pendingAction, setPendingAction] = useState('')
  const [copiedWalletKey, setCopiedWalletKey] = useState('')
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferAsset, setTransferAsset] = useState('USDC')
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferBalance, setTransferBalance] = useState(null)
  const [transferPending, setTransferPending] = useState(false)
  const [transferError, setTransferError] = useState('')
  const [transferTxHash, setTransferTxHash] = useState('')
  const [copiedTxHash, setCopiedTxHash] = useState(false)
  const [solanaNativeBalance, setSolanaNativeBalance] = useState(null)
  const [solanaTokenBalance, setSolanaTokenBalance] = useState(null)
  const [solanaBalancesPending, setSolanaBalancesPending] = useState(false)
  const [solanaBalancesError, setSolanaBalancesError] = useState('')
  const [solanaBalanceVersion, setSolanaBalanceVersion] = useState(0)
  const [solanaTransferKind, setSolanaTransferKind] = useState('deposit')
  const [solanaTransferAmount, setSolanaTransferAmount] = useState('')
  const [solanaTransferState, setSolanaTransferState] = useState(null)

  const setFeedbackError = useCallback(message => setFeedback({ type: 'error', message }), [])
  const setFeedbackSuccess = useCallback(message => setFeedback({ type: 'success', message }), [])
  const clearFeedback = useCallback(() => setFeedback(null), [])

  const { ready, authenticated, user, logout } = usePrivy()
  const { wallets: connectedWallets = [], ready: connectedWalletsReady } = useWallets()
  const { wallet: activePrivyWallet } = useActiveWallet()
  const [runtimeResolvedWallet, setRuntimeResolvedWallet] = useState(() => {
    if (typeof globalThis === 'undefined') return null
    return globalThis.__runtimeResolvedWallet || null
  })
  const [runtimeResolvedSolanaWallet, setRuntimeResolvedSolanaWallet] = useState(() => {
    if (typeof globalThis === 'undefined') return null
    return globalThis.__runtimeResolvedSolanaWallet || null
  })

  const { login } = useLogin({
    onError: error => {
      setPendingAction('')
      setFeedbackError(toPrivyErrorMessage(error, 'Unable to open Privy login.'))
    },
  })

  const { linkGoogle, linkTwitter, linkDiscord, linkWallet } = useLinkAccount({
    onSuccess: ({ linkMethod }) => {
      setPendingAction('')
      setFeedbackSuccess(`Linked ${humanizePrivyMethod(linkMethod)}.`)
    },
    onError: (error, details) => {
      setPendingAction('')
      const methodLabel = humanizePrivyMethod(details?.linkMethod, 'account')
      const reason = toPrivyErrorMessage(error, 'Unknown error')
      setFeedbackError(`Unable to link ${methodLabel}: ${reason}`)
    },
  })

  useEffect(() => {
    if (authenticated) setPendingAction('')
  }, [authenticated])

  useEffect(() => {
    if (typeof window === 'undefined') return () => {}

    const setFromGlobal = () => {
      setRuntimeResolvedWallet(globalThis.__runtimeResolvedWallet || null)
    }
    const onRuntimeWalletSnapshot = event => {
      const nextSnapshot = event?.detail || null
      setRuntimeResolvedWallet(nextSnapshot)
    }

    setFromGlobal()
    window.addEventListener('runtime-wallet-snapshot', onRuntimeWalletSnapshot)
    return () => {
      window.removeEventListener('runtime-wallet-snapshot', onRuntimeWalletSnapshot)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return () => {}

    const setFromGlobal = () => {
      setRuntimeResolvedSolanaWallet(globalThis.__runtimeResolvedSolanaWallet || null)
    }
    const onRuntimeSolanaWalletSnapshot = event => {
      const nextSnapshot = event?.detail || null
      setRuntimeResolvedSolanaWallet(nextSnapshot)
    }

    setFromGlobal()
    window.addEventListener('runtime-solana-wallet-snapshot', onRuntimeSolanaWalletSnapshot)
    return () => {
      window.removeEventListener('runtime-solana-wallet-snapshot', onRuntimeSolanaWalletSnapshot)
    }
  }, [])

  const linkedWallets = useMemo(() => {
    if (!user || !Array.isArray(user.linkedAccounts)) return []
    return user.linkedAccounts.filter(account => account?.type === 'wallet' && typeof account?.address === 'string' && account.address)
  }, [user])

  const connectedEvmWallets = useMemo(() => {
    if (!Array.isArray(connectedWallets)) return []
    return connectedWallets.filter(wallet => wallet?.type === 'ethereum' && typeof wallet?.address === 'string' && wallet.address)
  }, [connectedWallets])

  const connectedSolanaWallets = useMemo(() => {
    if (!Array.isArray(connectedWallets)) return []
    return connectedWallets.filter(wallet => wallet?.type === 'solana' && typeof wallet?.address === 'string' && wallet.address)
  }, [connectedWallets])

  const activeEvmWallet = useMemo(() => {
    const runtimeAddress = normalizeWalletAddress(runtimeResolvedWallet?.address || '', 'ethereum')
    if (runtimeResolvedWallet?.connected && runtimeAddress) {
      const runtimeMatch = connectedEvmWallets.find(wallet => sameWalletAddress(wallet.address, runtimeAddress, 'ethereum'))
      if (runtimeMatch) return runtimeMatch
    }

    if (activePrivyWallet?.type === 'ethereum') {
      const activeMatch = connectedEvmWallets.find(wallet =>
        sameWalletAddress(wallet.address, activePrivyWallet.address, 'ethereum')
      )
      if (activeMatch) return activeMatch
    }

    return getLatestConnectedWallet(connectedEvmWallets)
  }, [runtimeResolvedWallet, activePrivyWallet, connectedEvmWallets])

  const activeSolanaWallet = useMemo(() => {
    if (activePrivyWallet?.type === 'solana') {
      const activeMatch = connectedSolanaWallets.find(wallet =>
        sameWalletAddress(wallet.address, activePrivyWallet.address, 'solana')
      )
      if (activeMatch) return activeMatch
    }

    return getLatestConnectedWallet(connectedSolanaWallets)
  }, [activePrivyWallet, connectedSolanaWallets])

  const worldSolanaAddress = typeof runtimeResolvedSolanaWallet?.address === 'string' ? runtimeResolvedSolanaWallet.address : ''
  const worldSolanaConnected = !!runtimeResolvedSolanaWallet?.connected
  const worldSolanaAvailable = !!runtimeResolvedSolanaWallet?.available
  const worldSolanaCluster = typeof runtimeResolvedSolanaWallet?.cluster === 'string' ? runtimeResolvedSolanaWallet.cluster : 'mainnet'
  const solanaTransferBusy = solanaTransferState?.status === 'pending' || solanaTransferState?.status === 'signed'
  const solanaTransferExplorerUrl = getSolanaExplorerUrl(solanaTransferState?.signature, worldSolanaCluster)

  useEffect(() => {
    let cancelled = false

    if (!world?.solana || !worldSolanaConnected || !worldSolanaAddress) {
      setSolanaNativeBalance(null)
      setSolanaTokenBalance(null)
      setSolanaBalancesPending(false)
      setSolanaBalancesError('')
      return () => {
        cancelled = true
      }
    }

    const loadBalances = async () => {
      setSolanaBalancesPending(true)
      setSolanaBalancesError('')

      try {
        const nativeBalance = await world.solana.getNativeBalance(worldSolanaAddress)
        let tokenBalance = null
        try {
          tokenBalance = await world.solana.getWorldTokenBalance(worldSolanaAddress)
        } catch (error) {
          const message = error?.message || ''
          if (message !== 'World token mint address not configured' && message !== 'Invalid world token mint address') {
            throw error
          }
        }

        if (cancelled) return
        setSolanaNativeBalance(nativeBalance)
        setSolanaTokenBalance(tokenBalance)
      } catch (error) {
        if (cancelled) return
        setSolanaNativeBalance(null)
        setSolanaTokenBalance(null)
        setSolanaBalancesError(error?.message || 'Unable to load Solana balances.')
      } finally {
        if (!cancelled) {
          setSolanaBalancesPending(false)
        }
      }
    }

    void loadBalances()

    return () => {
      cancelled = true
    }
  }, [world, worldSolanaConnected, worldSolanaAddress, worldSolanaCluster, solanaBalanceVersion])

  useEffect(() => {
    if (!world?.solana?.on || !world?.solana?.off) return () => {}

    const onOperation = operation => {
      setSolanaTransferState(operation || null)
      if (operation?.status === 'confirmed') {
        setSolanaTransferAmount('')
        setSolanaBalanceVersion(version => version + 1)
      }
    }

    world.solana.on('operation', onOperation)
    return () => {
      world.solana.off('operation', onOperation)
    }
  }, [world])

  useEffect(() => {
    if (worldSolanaConnected) return
    setSolanaTransferState(null)
    setSolanaTransferAmount('')
  }, [worldSolanaConnected])

  const connectedSiteWalletRows = useMemo(() => {
    const rows = []
    if (activeEvmWallet) {
      rows.push({
        key: `connected:ethereum:${activeEvmWallet.address}`,
        chainLabel: 'EVM',
        wallet: activeEvmWallet,
      })
    }
    if (activeSolanaWallet) {
      rows.push({
        key: `connected:solana:${activeSolanaWallet.address}`,
        chainLabel: 'Solana',
        wallet: activeSolanaWallet,
      })
    }
    return rows
  }, [activeEvmWallet, activeSolanaWallet])

  const socialProviders = useMemo(() => {
    return [
      {
        key: 'google',
        label: 'Google',
        linkedType: 'google_oauth',
        subject: user?.google?.subject,
        handle: user?.google?.email || user?.google?.name,
        link: linkGoogle,
      },
      {
        key: 'discord',
        label: 'Discord',
        linkedType: 'discord_oauth',
        subject: user?.discord?.subject,
        handle: user?.discord?.username || user?.discord?.email,
        link: linkDiscord,
      },
      {
        key: 'twitter',
        label: 'X',
        linkedType: 'twitter_oauth',
        subject: user?.twitter?.subject,
        handle: user?.twitter?.username,
        link: linkTwitter,
      },
    ]
  }, [user, linkGoogle, linkTwitter, linkDiscord])

  const runLogin = useCallback(() => {
    clearFeedback()
    try {
      login()
    } catch (error) {
      setFeedbackError(toPrivyErrorMessage(error, 'Unable to open Privy login.'))
    }
  }, [login, clearFeedback, setFeedbackError])

  const runSignOut = useCallback(async () => {
    if (signingOut) return
    clearFeedback()
    setSigningOut(true)
    try {
      if (typeof onDisconnectWallet === 'function') {
        await onDisconnectWallet()
      } else {
        await logout()
      }
    } catch {
    } finally {
      setSigningOut(false)
    }
  }, [clearFeedback, logout, onDisconnectWallet, signingOut])

  const runLinkAction = useCallback(
    (key, action) => {
      clearFeedback()
      setPendingAction(`link-${key}`)
      try {
        action()
      } catch (error) {
        setPendingAction('')
        setFeedbackError(toPrivyErrorMessage(error, 'Unable to link account.'))
      }
    },
    [clearFeedback, setFeedbackError],
  )

  const runLinkWallet = useCallback(
    chain => {
      const options =
        chain === 'solana'
          ? { walletChainType: 'solana-only', description: 'Link a Solana wallet (Phantom, Backpack, etc).' }
          : { walletChainType: 'ethereum-only', description: 'Link an Ethereum wallet to this user.' }
      runLinkAction(`wallet-${chain}`, () => linkWallet(options))
    },
    [linkWallet, runLinkAction],
  )

  const copyWalletAddress = useCallback(async key => {
    const wallet = connectedSiteWalletRows.find(row => row.key === key)?.wallet || null
    const address = typeof wallet?.address === 'string' ? wallet.address : ''
    if (!address) return

    const copied = await copyToClipboard(address)
    if (!copied) {
      setFeedbackError('Unable to copy wallet address.')
      return
    }

    setCopiedWalletKey(key)
    setTimeout(() => {
      setCopiedWalletKey(current => (current === key ? '' : current))
    }, 1200)
  }, [connectedSiteWalletRows, setFeedbackError])

  const refreshTransferBalance = useCallback(async () => {
    if (!transferOpen) return
    if (!activeEvmWallet?.address) {
      setTransferBalance(null)
      return
    }
    if (!world?.evm) {
      setTransferBalance(null)
      return
    }

    const address = activeEvmWallet.address
    try {
      const nextBalance =
        transferAsset === 'USDC'
          ? await world.evm.getUSDCBalance(address)
          : await world.evm.getNativeBalance(address)
      setTransferBalance(Number.isFinite(nextBalance) ? nextBalance : null)
    } catch {
      setTransferBalance(null)
    }
  }, [transferOpen, activeEvmWallet, transferAsset, world])

  useEffect(() => {
    void refreshTransferBalance()
  }, [refreshTransferBalance])

  useEffect(() => {
    if (activeEvmWallet?.address) return
    setTransferOpen(false)
    setTransferPending(false)
    setTransferError('')
    setTransferTxHash('')
    setCopiedTxHash(false)
  }, [activeEvmWallet])

  const openTransferPanel = useCallback(() => {
    setTransferOpen(true)
    setTransferError('')
    setTransferTxHash('')
    setCopiedTxHash(false)
  }, [])

  const closeTransferPanel = useCallback(() => {
    if (transferPending) return
    setTransferOpen(false)
    setTransferError('')
    setTransferTxHash('')
    setCopiedTxHash(false)
  }, [transferPending])

  const copyTransferTxHash = useCallback(async () => {
    if (!transferTxHash) return
    const copied = await copyToClipboard(transferTxHash)
    if (!copied) {
      setTransferError('Unable to copy transaction hash.')
      return
    }
    setCopiedTxHash(true)
    setTimeout(() => {
      setCopiedTxHash(false)
    }, 1200)
  }, [transferTxHash])

  const submitTransfer = useCallback(async () => {
    if (transferPending) return
    if (!world?.evm) {
      setTransferError('EVM wallet is unavailable.')
      return
    }

    const destination = transferTo.trim()
    if (!/^0x[a-fA-F0-9]{40}$/.test(destination)) {
      setTransferError('Enter a valid recipient address.')
      return
    }

    const amountValue = transferAmount.trim()
    if (!amountValue) {
      setTransferError('Enter an amount.')
      return
    }
    const parsed = Number(amountValue)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setTransferError('Amount must be greater than 0.')
      return
    }

    setTransferPending(true)
    setTransferError('')
    setTransferTxHash('')
    setCopiedTxHash(false)

    try {
      const result =
        transferAsset === 'USDC'
          ? await world.evm.transferUSDC(destination, amountValue)
          : await world.evm.transferNative(destination, amountValue)
      const hash = typeof result?.hash === 'string' ? result.hash : ''
      if (hash) {
        setTransferTxHash(hash)
      }
      setTransferAmount('')
      setFeedbackSuccess(`${transferAsset} transfer submitted.`)
      await refreshTransferBalance()
    } catch (error) {
      setTransferError(toPrivyErrorMessage(error, `Unable to transfer ${transferAsset}.`))
    } finally {
      setTransferPending(false)
    }
  }, [
    transferPending,
    world,
    transferTo,
    transferAmount,
    transferAsset,
    refreshTransferBalance,
    setFeedbackSuccess,
  ])

  const runWorldSolanaConnect = useCallback(async () => {
    if (pendingAction === 'world-solana-connect' || pendingAction === 'world-solana-disconnect') return
    clearFeedback()
    if (!world?.solana) {
      setFeedbackError('Solana wallet controls are unavailable.')
      return
    }
    setPendingAction('world-solana-connect')
    try {
      await world.solana.connect()
    } catch (error) {
      setFeedbackError(toPrivyErrorMessage(error, 'Unable to connect Solana wallet.'))
    } finally {
      setPendingAction(current => (current === 'world-solana-connect' ? '' : current))
    }
  }, [clearFeedback, pendingAction, setFeedbackError, world])

  const runWorldSolanaDisconnect = useCallback(async () => {
    if (pendingAction === 'world-solana-connect' || pendingAction === 'world-solana-disconnect') return
    clearFeedback()
    if (!world?.solana) {
      setFeedbackError('Solana wallet controls are unavailable.')
      return
    }
    setPendingAction('world-solana-disconnect')
    try {
      await world.solana.disconnect()
    } catch (error) {
      setFeedbackError(toPrivyErrorMessage(error, 'Unable to disconnect Solana wallet.'))
    } finally {
      setPendingAction(current => (current === 'world-solana-disconnect' ? '' : current))
    }
  }, [clearFeedback, pendingAction, setFeedbackError, world])

  const submitWorldSolanaTransfer = useCallback(async () => {
    if (solanaTransferBusy) return
    clearFeedback()

    if (!world?.solana) {
      setFeedbackError('Solana wallet controls are unavailable.')
      return
    }
    if (!worldSolanaConnected) {
      setFeedbackError('Connect a Solana wallet first.')
      return
    }

    const amountValue = solanaTransferAmount.trim()
    if (!amountValue) {
      setFeedbackError('Enter an amount.')
      return
    }
    const parsedAmount = Number(amountValue)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFeedbackError('Amount must be greater than 0.')
      return
    }

    try {
      if (solanaTransferKind === 'deposit') {
        await world.solana.deposit(amountValue)
      } else {
        await world.solana.withdraw(amountValue)
      }
    } catch (error) {
      const message = toPrivyErrorMessage(
        error,
        `Unable to ${solanaTransferKind === 'deposit' ? 'deposit' : 'withdraw'} world token.`
      )
      setSolanaTransferState(current =>
        current?.status === 'failed'
          ? current
          : {
              requestId: `local-${Date.now()}`,
              kind: solanaTransferKind,
              amount: amountValue,
              status: 'failed',
              signature: null,
              error: message,
            }
      )
      setFeedbackError(message)
    }
  }, [
    clearFeedback,
    setFeedbackError,
    solanaTransferAmount,
    solanaTransferBusy,
    solanaTransferKind,
    world,
    worldSolanaConnected,
  ])

  const isAuthenticated = ready && authenticated && user

  const renderWalletsSection = () => {
    const linkingEvm = pendingAction === 'link-wallet-evm'
    const linkingSolana = pendingAction === 'link-wallet-solana'
    const connectingWorldSolana = pendingAction === 'world-solana-connect'
    const disconnectingWorldSolana = pendingAction === 'world-solana-disconnect'

    return (
      <div className='usermenu-section'>
        <div className='usermenu-section-label'>Wallets</div>
        <div className='usermenu-subsection-label'>Connected To Site</div>
        {!connectedWalletsReady ? (
          <div className='usermenu-muted'>Loading connected wallets...</div>
        ) : connectedSiteWalletRows.length > 0 ? (
          <div className='usermenu-rows'>
            {connectedSiteWalletRows.map(row => (
              <div key={row.key} className='usermenu-row'>
                <div className='usermenu-row-label'>{row.chainLabel}</div>
                <div className='usermenu-row-value'>
                  <div className='usermenu-wallet-row'>
                    <span className='usermenu-wallet-address mono'>{truncateAddress(row.wallet.address)}</span>
                    <span className='usermenu-chip active'>Active</span>
                    {row.chainLabel === 'EVM' && (
                      <button
                        className='usermenu-chipbtn'
                        disabled={!world?.evm}
                        onClick={() => {
                          openTransferPanel()
                        }}
                      >
                        Send
                      </button>
                    )}
                    <button
                      className='usermenu-chipbtn'
                      onClick={() => {
                        void copyWalletAddress(row.key)
                      }}
                    >
                      {copiedWalletKey === row.key ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='usermenu-muted'>No connected wallets.</div>
        )}
        {transferOpen && activeEvmWallet && (
          <div className='usermenu-transfer-panel'>
            <div className='usermenu-transfer-head'>
              <div className='usermenu-transfer-title'>Send From {truncateAddress(activeEvmWallet.address)}</div>
              <button className='usermenu-linkbtn' disabled={transferPending} onClick={closeTransferPanel}>
                Close
              </button>
            </div>
            <div className='usermenu-transfer-grid'>
              <label className='usermenu-field'>
                <div className='usermenu-label'>Asset</div>
                <select
                  className='usermenu-input usermenu-select'
                  value={transferAsset}
                  disabled={transferPending}
                  onChange={event => {
                    setTransferAsset(event.target.value === 'ETH' ? 'ETH' : 'USDC')
                    setTransferError('')
                    setTransferTxHash('')
                    setCopiedTxHash(false)
                  }}
                >
                  <option value='USDC'>USDC</option>
                  <option value='ETH'>ETH</option>
                </select>
              </label>
              <label className='usermenu-field'>
                <div className='usermenu-label'>Recipient</div>
                <input
                  className='usermenu-input mono'
                  placeholder='0x...'
                  value={transferTo}
                  disabled={transferPending}
                  onChange={event => {
                    setTransferTo(event.target.value)
                    setTransferError('')
                  }}
                />
              </label>
              <label className='usermenu-field'>
                <div className='usermenu-label'>Amount</div>
                <input
                  className='usermenu-input'
                  placeholder='0.0'
                  value={transferAmount}
                  disabled={transferPending}
                  onChange={event => {
                    setTransferAmount(event.target.value)
                    setTransferError('')
                  }}
                />
              </label>
            </div>
            <div className='usermenu-transfer-meta'>
              Available: {formatBalance(transferBalance, transferAsset === 'USDC' ? 2 : 6)} {transferAsset}
            </div>
            {transferError && <div className='usermenu-error'>{transferError}</div>}
            {transferTxHash && (
              <div className='usermenu-transfer-tx'>
                <div className='usermenu-transfer-tx-value mono'>{truncateAddress(transferTxHash)}</div>
                <div className='usermenu-inlineactions'>
                  <button
                    className='usermenu-linkbtn'
                    onClick={() => {
                      void copyTransferTxHash()
                    }}
                  >
                    {copiedTxHash ? 'Copied' : 'Copy Tx'}
                  </button>
                  <a
                    className='usermenu-linkbtn'
                    href={`https://arbiscan.io/tx/${transferTxHash}`}
                    target='_blank'
                    rel='noreferrer'
                  >
                    View
                  </a>
                </div>
              </div>
            )}
            <div className='usermenu-inlineactions'>
              <button
                className='usermenu-linkbtn'
                disabled={transferPending}
                onClick={() => {
                  void submitTransfer()
                }}
              >
                {transferPending ? 'Sending...' : `Send ${transferAsset}`}
              </button>
            </div>
          </div>
        )}

        <div className='usermenu-subsection-label'>Solana In World</div>
        <div className='usermenu-solana-panel'>
          <div className='usermenu-row'>
            <div className='usermenu-row-label'>Status</div>
            <div className='usermenu-row-value'>
              <div className='usermenu-wallet-row'>
                <span className={cls('usermenu-chip', { active: worldSolanaConnected })}>
                  {worldSolanaConnected ? 'Connected' : worldSolanaAvailable ? 'Disconnected' : 'Unavailable'}
                </span>
                {(worldSolanaAvailable || worldSolanaConnected) && (
                  <span className='usermenu-chip'>{getSolanaClusterLabel(worldSolanaCluster)}</span>
                )}
              </div>
            </div>
          </div>
          <div className='usermenu-row'>
            <div className='usermenu-row-label'>Wallet</div>
            <div className='usermenu-row-value mono'>
              {worldSolanaAddress ? truncateAddress(worldSolanaAddress) : 'Not connected'}
            </div>
          </div>
          <div className='usermenu-row'>
            <div className='usermenu-row-label'>Native</div>
            <div className='usermenu-row-value'>
              {!worldSolanaConnected
                ? 'Not connected'
                : solanaBalancesPending
                  ? 'Loading...'
                  : `${formatBalance(solanaNativeBalance, 6)} SOL`}
            </div>
          </div>
          <div className='usermenu-row'>
            <div className='usermenu-row-label'>World Token</div>
            <div className='usermenu-row-value'>
              {!worldSolanaConnected
                ? 'Not connected'
                : solanaBalancesPending
                ? 'Loading...'
                : solanaTokenBalance === null
                  ? 'Not configured'
                  : formatBalance(solanaTokenBalance, 6)}
            </div>
          </div>
          {solanaBalancesError && <div className='usermenu-error'>{solanaBalancesError}</div>}
          {!worldSolanaAvailable && <div className='usermenu-muted'>Link or enable a Solana wallet first.</div>}
          <div className='usermenu-inlineactions'>
            <button
              className='usermenu-linkbtn'
              disabled={!world?.solana || !worldSolanaAvailable || worldSolanaConnected || disconnectingWorldSolana}
              onClick={() => {
                void runWorldSolanaConnect()
              }}
            >
              {connectingWorldSolana ? 'Connecting...' : 'Connect'}
            </button>
            <button
              className='usermenu-linkbtn'
              disabled={!world?.solana || !worldSolanaConnected || connectingWorldSolana}
              onClick={() => {
                void runWorldSolanaDisconnect()
              }}
            >
              {disconnectingWorldSolana ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
          {worldSolanaConnected && (
            <div className='usermenu-transfer-panel'>
              <div className='usermenu-transfer-head'>
                <div className='usermenu-transfer-title'>World Token Transfer</div>
                <div className='usermenu-inlineactions'>
                  <button
                    className={cls('usermenu-chipbtn', { active: solanaTransferKind === 'deposit' })}
                    disabled={solanaTransferBusy}
                    onClick={() => {
                      setSolanaTransferKind('deposit')
                    }}
                  >
                    Deposit
                  </button>
                  <button
                    className={cls('usermenu-chipbtn', { active: solanaTransferKind === 'withdraw' })}
                    disabled={solanaTransferBusy}
                    onClick={() => {
                      setSolanaTransferKind('withdraw')
                    }}
                  >
                    Withdraw
                  </button>
                </div>
              </div>
              <div className='usermenu-transfer-grid'>
                <label className='usermenu-field'>
                  <span className='usermenu-label'>Amount</span>
                  <input
                    className='usermenu-input'
                    value={solanaTransferAmount}
                    onInput={event => {
                      setSolanaTransferAmount(event.currentTarget.value)
                    }}
                    placeholder='0.00'
                    inputMode='decimal'
                  />
                </label>
              </div>
              <div className='usermenu-inlineactions'>
                <button
                  className='usermenu-linkbtn'
                  disabled={solanaTransferBusy}
                  onClick={() => {
                    void submitWorldSolanaTransfer()
                  }}
                >
                  {solanaTransferBusy
                    ? solanaTransferState?.status === 'signed'
                      ? 'Confirming...'
                      : 'Awaiting Signature...'
                    : solanaTransferKind === 'deposit'
                      ? 'Deposit'
                      : 'Withdraw'}
                </button>
              </div>
              {solanaTransferState && (
                <div className='usermenu-solana-transfer-status'>
                  <div className='usermenu-transfer-tx'>
                    <div className='usermenu-wallet-row'>
                      <span
                        className={cls('usermenu-chip', {
                          active:
                            solanaTransferState.status === 'pending' ||
                            solanaTransferState.status === 'signed' ||
                            solanaTransferState.status === 'confirmed',
                        })}
                      >
                        {getSolanaTransferStatusLabel(solanaTransferState.status)}
                      </span>
                    </div>
                    {solanaTransferExplorerUrl && (
                      <a className='usermenu-linkbtn' href={solanaTransferExplorerUrl} target='_blank' rel='noreferrer'>
                        View Tx
                      </a>
                    )}
                  </div>
                  <div className='usermenu-transfer-meta'>
                    {solanaTransferState.kind === 'withdraw' ? 'Withdraw' : 'Deposit'} {solanaTransferState.amount}
                  </div>
                  <div
                    className={cls({
                      'usermenu-error': solanaTransferState.status === 'failed',
                      'usermenu-muted': solanaTransferState.status !== 'failed',
                    })}
                  >
                    {getSolanaTransferStatusMessage(solanaTransferState)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className='usermenu-subsection-label'>Linked To Account</div>
        {!isAuthenticated ? (
          <div className='usermenu-muted'>Sign in to link wallets.</div>
        ) : (
          <>
            {linkedWallets.length > 0 ? (
              <div className='usermenu-rows'>
                {linkedWallets.map(wallet => {
                  const key = `${wallet.chainType || 'wallet'}:${wallet.address}`
                  return (
                    <div key={key} className='usermenu-row'>
                      <div className='usermenu-row-label'>{getWalletChainLabel(wallet.chainType)}</div>
                      <div className='usermenu-row-value mono'>{truncateAddress(wallet.address)}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className='usermenu-muted'>No linked wallets.</div>
            )}
            <div className='usermenu-row'>
              <div className='usermenu-row-label usermenu-muted'>Add wallet</div>
              <div className='usermenu-inlineactions'>
                <button
                  className='usermenu-linkbtn'
                  disabled={linkingEvm}
                  onClick={() => {
                    if (linkingEvm) return
                    runLinkWallet('evm')
                  }}
                >
                  {linkingEvm ? 'Linking...' : 'EVM'}
                </button>
                <button
                  className='usermenu-linkbtn'
                  disabled={linkingSolana}
                  onClick={() => {
                    if (linkingSolana) return
                    runLinkWallet('solana')
                  }}
                >
                  {linkingSolana ? 'Linking...' : 'Solana'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  const renderSocialSection = () => {
    return (
      <div className='usermenu-section'>
        <div className='usermenu-section-label'>Social</div>
        {!isAuthenticated ? (
          <div className='usermenu-muted'>Sign in to link social accounts.</div>
        ) : (
          <div className='usermenu-rows'>
            {socialProviders.map(provider => {
              const isLinked = !!provider.subject || hasLinkedAccountType(user, provider.linkedType)
              const isBusy = pendingAction === `link-${provider.key}`
              return (
                <div key={provider.key} className='usermenu-row'>
                  <div className='usermenu-row-label'>{provider.label}</div>
                  <div className='usermenu-row-value'>
                    {isLinked ? (
                      <span className='usermenu-linked-handle'>{provider.handle ? `@${provider.handle}` : 'Linked'}</span>
                    ) : (
                      <button
                        className='usermenu-linkbtn'
                        disabled={isBusy}
                        onClick={() => {
                          if (isBusy) return
                          runLinkAction(provider.key, provider.link)
                        }}
                      >
                        {isBusy ? 'Linking...' : 'Link'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderAccountFooter = () => {
    if (!isAuthenticated) {
      return (
        <div className='usermenu-footer'>
          <button className='usermenu-btn' onClick={runLogin}>
            Sign In
          </button>
        </div>
      )
    }

    const displayName = getDisplayName(user)
    const primaryEmail = getPrimaryEmail(user)

    return (
      <div className='usermenu-footer'>
        <div className='usermenu-footer-identity'>
          <span className='usermenu-footer-name'>{displayName}</span>
          {primaryEmail && <span className='usermenu-footer-email'>{primaryEmail}</span>}
        </div>
        <button
          className={cls('usermenu-btn danger', { disabled: signingOut })}
          onClick={() => {
            if (signingOut) return
            void runSignOut()
          }}
        >
          {signingOut ? <LoaderIcon size='0.85rem' /> : <LogOutIcon size='0.85rem' />}
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <>
      <div className='usermenu-scroll'>
        {children}
        <div className='usermenu-divider' />
        {renderWalletsSection()}
        <div className='usermenu-divider' />
        {renderSocialSection()}
        {feedback && (
          <div className={cls('usermenu-feedback', { success: feedback.type === 'success', error: feedback.type === 'error' })}>
            {feedback.message}
          </div>
        )}
      </div>
      {renderAccountFooter()}
    </>
  )
}

export function EditorUserMenu({ open, auth, world, onClose, onDisconnectWallet }) {
  const apiBaseUrl = useMemo(resolveWorldServiceApiBase, [])
  const isPrivyMode = auth?.mode === 'privy'
  const canManageWorld = !!auth?.connected

  const [loadingWorld, setLoadingWorld] = useState(false)
  const [ownedWorld, setOwnedWorld] = useState(null)
  const [worldError, setWorldError] = useState('')
  const [worldName, setWorldName] = useState('My World')
  const [worldSlug, setWorldSlug] = useState('my-world')
  const [worldDescription, setWorldDescription] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [createError, setCreateError] = useState('')
  const [creatingWorld, setCreatingWorld] = useState(false)

  const refreshOwnedWorld = useCallback(async () => {
    if (!apiBaseUrl) {
      setOwnedWorld(null)
      setWorldError('World service API is unavailable.')
      return
    }
    setLoadingWorld(true)
    setWorldError('')
    const result = await requestJson(`${apiBaseUrl}/my/worlds`, { method: 'GET' })
    setLoadingWorld(false)
    if (!result.ok) {
      if (result.status === 401) {
        setOwnedWorld(null)
        setWorldError('Session expired. Please sign in again.')
        return
      }
      setOwnedWorld(null)
      setWorldError(getErrorMessage(result.body, 'Unable to load your world.'))
      return
    }
    const owned = Array.isArray(result.body?.owned) ? result.body.owned : []
    const world = owned[0] || null
    setOwnedWorld(world)
    if (world) {
      const nextName = typeof world.name === 'string' ? world.name : 'My World'
      const nextSlug = typeof world.slug === 'string' ? world.slug : slugify(nextName)
      const nextDescription = typeof world.description === 'string' ? world.description : ''
      setWorldName(nextName)
      setWorldSlug(nextSlug)
      setWorldDescription(nextDescription)
      setSlugEdited(true)
    }
  }, [apiBaseUrl])

  useEffect(() => {
    if (!open) return
    setCreateError('')
    if (!canManageWorld) {
      setLoadingWorld(false)
      setOwnedWorld(null)
      setWorldError('')
      return
    }
    void refreshOwnedWorld()
  }, [open, canManageWorld, refreshOwnedWorld])

  useEffect(() => {
    if (slugEdited) return
    setWorldSlug(slugify(worldName))
  }, [worldName, slugEdited])

  useEffect(() => {
    if (!open) return
    const onKeyDown = event => {
      if (event.code === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const createWorld = async () => {
    if (creatingWorld || loadingWorld) return
    if (!apiBaseUrl) {
      setCreateError('World service API is unavailable.')
      return
    }
    const normalizedName = worldName.trim()
    const normalizedSlug = slugify(worldSlug)
    const normalizedDescription = worldDescription.trim()
    if (!normalizedName) {
      setCreateError('World name is required.')
      return
    }
    if (normalizedSlug.length < 3) {
      setCreateError('Slug must be at least 3 characters.')
      return
    }
    if (!WORLD_SLUG_REGEX.test(normalizedSlug)) {
      setCreateError('Slug can only use lowercase letters, numbers, and hyphens.')
      return
    }
    setCreateError('')
    setCreatingWorld(true)
    const result = await requestJson(`${apiBaseUrl}/worlds`, {
      method: 'POST',
      body: JSON.stringify({
        slug: normalizedSlug,
        name: normalizedName,
        ...(normalizedDescription ? { description: normalizedDescription } : null),
      }),
    })
    setCreatingWorld(false)
    if (!result.ok) {
      const code = typeof result.body?.error === 'string' ? result.body.error : ''
      if (result.status === 401) {
        setCreateError('Session expired. Please sign in again.')
        return
      }
      if (result.status === 409 && code === 'world_limit_reached') {
        setCreateError('A personal world already exists for this account.')
        await refreshOwnedWorld()
        return
      }
      if (result.status === 409 && code.toLowerCase().includes('slug')) {
        setCreateError('That slug is already in use.')
        return
      }
      setCreateError(getErrorMessage(result.body, 'Unable to create world.'))
      return
    }
    const created = result.body?.world || null
    if (created) {
      setOwnedWorld(created)
      setSlugEdited(true)
      setCreateError('')
      return
    }
    await refreshOwnedWorld()
  }

  const openMyWorld = () => {
    const slug = typeof ownedWorld?.slug === 'string' ? ownedWorld.slug.trim() : ''
    if (!slug) return
    window.location.href = `/worlds/${slug}`
  }

  const renderWorldSection = () => {
    if (!canManageWorld) {
      return (
        <div className='usermenu-hero'>
          <div className='usermenu-section-label'>World</div>
          <div className='usermenu-muted'>Sign in to manage your world.</div>
        </div>
      )
    }

    if (loadingWorld) {
      return (
        <div className='usermenu-hero'>
          <div className='usermenu-section-label'>World</div>
          <div className='usermenu-muted'>
            <LoaderIcon size='0.85rem' style={{ verticalAlign: 'text-bottom', marginRight: '0.35rem' }} />
            Loading...
          </div>
        </div>
      )
    }

    if (worldError && !ownedWorld) {
      return (
        <div className='usermenu-hero'>
          <div className='usermenu-section-label'>World</div>
          <div className='usermenu-error'>{worldError}</div>
        </div>
      )
    }

    if (ownedWorld) {
      return (
        <div className='usermenu-hero usermenu-hero--world'>
          <div className='usermenu-section-label'>World</div>
          <div className='usermenu-hero-name'>{ownedWorld.name || 'My World'}</div>
          <div className='usermenu-hero-slug'>/{ownedWorld.slug}</div>
          <div className='usermenu-hero-actions'>
            <button className='usermenu-btn-enter' onClick={openMyWorld}>
              Enter
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className='usermenu-hero'>
        <div className='usermenu-section-label'>Create Your World</div>
        <label className='usermenu-field'>
          <div className='usermenu-label'>Name</div>
          <input
            className='usermenu-input'
            value={worldName}
            maxLength={100}
            onChange={event => setWorldName(event.target.value)}
          />
        </label>
        <label className='usermenu-field'>
          <div className='usermenu-label'>Slug</div>
          <input
            className='usermenu-input'
            value={worldSlug}
            maxLength={32}
            onChange={event => {
              setSlugEdited(true)
              setWorldSlug(slugify(event.target.value))
            }}
          />
        </label>
        <label className='usermenu-field'>
          <div className='usermenu-label'>Description (optional)</div>
          <textarea
            className='usermenu-textarea'
            value={worldDescription}
            maxLength={1000}
            onChange={event => setWorldDescription(event.target.value)}
          />
        </label>
        {createError && <div className='usermenu-error'>{createError}</div>}
        <div className='usermenu-hero-actions'>
          <button
            className={cls('usermenu-btn-primary', { disabled: creatingWorld || loadingWorld })}
            onClick={() => {
              if (creatingWorld || loadingWorld) return
              void createWorld()
            }}
          >
            {creatingWorld && <LoaderIcon size='0.85rem' />}
            {creatingWorld ? 'Creating...' : 'Create World'}
          </button>
        </div>
      </div>
    )
  }

  if (!open) return null

  return (
    <div
      className='usermenu'
      css={css`
        position: absolute;
        inset: 0;
        z-index: 100;
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        .usermenu-backdrop {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(15px);
        }
        .usermenu-panel {
          position: relative;
          z-index: 1;
          width: 26rem;
          max-width: calc(100% - 2rem);
          max-height: calc(100% - 2rem);
          display: flex;
          flex-direction: column;
          background: ${theme.bgPanel};
          border: 1px solid ${theme.border};
          border-radius: ${theme.radius};
          overflow: hidden;
        }
        .usermenu-head {
          height: 3.5rem;
          padding: 0 0.75rem 0 1rem;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          border-bottom: 1px solid ${theme.borderLight};
          flex-shrink: 0;
        }
        .usermenu-head-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
        }
        .usermenu-head-spacer {
          flex: 1;
        }
        .usermenu-close {
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: ${theme.radiusSmall};
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          &:hover {
            color: white;
            background: ${theme.bgHover};
          }
        }
        .usermenu-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .usermenu-divider {
          height: 1px;
          background: ${theme.borderLight};
          flex-shrink: 0;
        }
        .usermenu-section-label {
          font-size: 0.68rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.35);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 0.5rem;
        }
        .usermenu-subsection-label {
          font-size: 0.66rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.42);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin: 0.4rem 0 0.2rem;
        }
        .usermenu-hero {
          padding: 1.1rem 1rem;
          background: ${theme.bgInputSolid};
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          flex-shrink: 0;
        }
        .usermenu-hero--world {
          padding: 1.5rem 1rem 1.25rem;
          align-items: center;
          text-align: center;
          background: linear-gradient(160deg, rgba(80, 60, 120, 0.45) 0%, rgba(28, 30, 40, 0.55) 100%);
          border-bottom: 1px solid rgba(180, 140, 255, 0.12);
        }
        .usermenu-hero-name {
          font-size: 1.05rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
          line-height: 1.2;
        }
        .usermenu-hero--world .usermenu-hero-name {
          font-size: 1.2rem;
          background: linear-gradient(135deg, #fff 0%, rgba(200, 170, 255, 0.95) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .usermenu-hero-slug {
          font-size: 0.78rem;
          color: rgba(255, 255, 255, 0.4);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
        }
        .usermenu-hero--world .usermenu-hero-slug {
          color: rgba(180, 150, 255, 0.5);
        }
        .usermenu-hero-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.35rem;
        }
        .usermenu-btn-primary {
          height: 2.25rem;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: ${theme.radiusSmall};
          padding: 0 1rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
          background: rgba(255, 255, 255, 0.08);
          cursor: pointer;
          &:hover {
            background: rgba(255, 255, 255, 0.13);
            border-color: rgba(255, 255, 255, 0.25);
          }
          &.disabled {
            cursor: default;
            color: rgba(255, 255, 255, 0.4);
            background: transparent;
            border-color: ${theme.border};
          }
        }
        .usermenu-btn-enter {
          height: 2.25rem;
          border: 1px solid rgba(180, 140, 255, 0.4);
          border-radius: ${theme.radiusSmall};
          padding: 0 1.5rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: rgba(230, 210, 255, 0.95);
          background: linear-gradient(135deg, rgba(120, 80, 200, 0.35) 0%, rgba(80, 50, 150, 0.25) 100%);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          &::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%);
            pointer-events: none;
          }
          &:hover {
            background: linear-gradient(135deg, rgba(140, 100, 220, 0.5) 0%, rgba(100, 65, 180, 0.4) 100%);
            border-color: rgba(200, 170, 255, 0.6);
            color: #fff;
          }
        }
        .usermenu-section {
          padding: 0.85rem 1rem;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }
        .usermenu-rows {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .usermenu-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.6rem;
          padding: 0.4rem 0;
        }
        .usermenu-row-label {
          font-size: 0.82rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.75);
        }
        .usermenu-row-value {
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.55);
        }
        .usermenu-wallet-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 0.3rem;
        }
        .usermenu-wallet-address {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.74rem;
        }
        .usermenu-chip {
          border: 1px solid ${theme.borderLight};
          border-radius: 999px;
          padding: 0.12rem 0.38rem;
          font-size: 0.66rem;
          font-weight: 700;
          line-height: 1;
          color: rgba(255, 255, 255, 0.62);
          background: rgba(255, 255, 255, 0.03);
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .usermenu-chip.active {
          border-color: rgba(110, 255, 163, 0.45);
          color: rgba(156, 255, 193, 0.96);
          background: rgba(58, 130, 84, 0.22);
        }
        .usermenu-chipbtn {
          border: 1px solid ${theme.borderLight};
          border-radius: 999px;
          padding: 0.12rem 0.38rem;
          font-size: 0.66rem;
          font-weight: 700;
          line-height: 1;
          color: rgba(255, 255, 255, 0.78);
          background: rgba(255, 255, 255, 0.04);
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          cursor: pointer;
          &:hover {
            color: rgba(255, 255, 255, 0.96);
            border-color: ${theme.borderHover};
            background: rgba(255, 255, 255, 0.08);
          }
          &:disabled {
            cursor: default;
            color: rgba(255, 255, 255, 0.4);
            border-color: ${theme.borderLight};
            background: rgba(255, 255, 255, 0.02);
          }
        }
        .usermenu-chipbtn.active {
          border-color: rgba(110, 255, 163, 0.45);
          color: rgba(156, 255, 193, 0.96);
          background: rgba(58, 130, 84, 0.22);
        }
        .usermenu-transfer-panel {
          margin-top: 0.5rem;
          border: 1px solid ${theme.borderLight};
          border-radius: ${theme.radiusSmall};
          background: rgba(0, 0, 0, 0.16);
          padding: 0.55rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .usermenu-solana-panel {
          margin-top: 0.35rem;
          border: 1px solid ${theme.borderLight};
          border-radius: ${theme.radiusSmall};
          background: rgba(0, 0, 0, 0.16);
          padding: 0.55rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .usermenu-solana-transfer-status {
          border: 1px solid ${theme.borderLight};
          border-radius: ${theme.radiusSmall};
          background: rgba(255, 255, 255, 0.03);
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .usermenu-transfer-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .usermenu-transfer-title {
          font-size: 0.74rem;
          color: rgba(255, 255, 255, 0.74);
          font-weight: 600;
        }
        .usermenu-transfer-grid {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .usermenu-transfer-meta {
          font-size: 0.74rem;
          color: rgba(255, 255, 255, 0.52);
        }
        .usermenu-transfer-tx {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .usermenu-transfer-tx-value {
          color: rgba(255, 255, 255, 0.72);
          font-size: 0.74rem;
        }
        .usermenu-row-value.mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
          font-size: 0.75rem;
        }
        .usermenu-linked-handle {
          font-size: 0.78rem;
          color: rgba(255, 255, 255, 0.45);
        }
        .usermenu-inlineactions {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .usermenu-linkbtn {
          height: 1.9rem;
          border: 1px solid ${theme.border};
          border-radius: ${theme.radiusSmall};
          padding: 0 0.55rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.75);
          background: transparent;
          cursor: pointer;
          white-space: nowrap;
          &:hover {
            background: ${theme.bgHover};
            color: rgba(255, 255, 255, 0.95);
          }
          &:disabled {
            cursor: default;
            color: rgba(255, 255, 255, 0.35);
            border-color: ${theme.borderLight};
          }
        }
        .usermenu-muted {
          font-size: 0.82rem;
          color: rgba(255, 255, 255, 0.35);
        }
        .usermenu-error {
          font-size: 0.8rem;
          color: #ff8e8e;
        }
        .usermenu-field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .usermenu-label {
          font-size: 0.68rem;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .usermenu-input,
        .usermenu-textarea {
          width: 100%;
          border: 1px solid ${theme.border};
          background: rgba(0, 0, 0, 0.2);
          color: rgba(255, 255, 255, 0.95);
          font-size: 0.85rem;
          border-radius: ${theme.radiusSmall};
          padding: 0.5rem 0.6rem;
          &:focus {
            border-color: ${theme.borderHover};
            outline: none;
          }
        }
        .usermenu-select {
          appearance: none;
        }
        .usermenu-textarea {
          min-height: 4rem;
          resize: vertical;
        }
        .usermenu-footer {
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          border-top: 1px solid ${theme.borderLight};
          flex-shrink: 0;
        }
        .usermenu-footer-identity {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          min-width: 0;
        }
        .usermenu-footer-name {
          font-size: 0.82rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .usermenu-footer-email {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.35);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .usermenu-btn {
          height: 2.1rem;
          border: 1px solid ${theme.border};
          border-radius: ${theme.radiusSmall};
          padding: 0 0.8rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          font-size: 0.78rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
          background: transparent;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          &:hover {
            background: ${theme.bgHover};
          }
          &.danger {
            border-color: rgba(255, 125, 125, 0.35);
            color: rgba(255, 175, 175, 0.9);
          }
          &.disabled {
            cursor: default;
            color: rgba(255, 255, 255, 0.35);
            background: transparent;
          }
        }
        .usermenu-feedback {
          margin: 0 1rem 0.75rem;
          font-size: 0.8rem;
          border: 1px solid ${theme.border};
          border-radius: ${theme.radiusSmall};
          padding: 0.5rem 0.6rem;
          background: rgba(255, 255, 255, 0.03);
          color: rgba(255, 255, 255, 0.7);
          flex-shrink: 0;
        }
        .usermenu-feedback.success {
          border-color: rgba(102, 240, 150, 0.35);
          color: rgba(164, 255, 194, 0.95);
          background: rgba(49, 122, 74, 0.2);
        }
        .usermenu-feedback.error {
          border-color: rgba(255, 110, 110, 0.35);
          color: rgba(255, 180, 180, 0.95);
          background: rgba(122, 49, 49, 0.2);
        }
      `}
    >
      <div className='usermenu-backdrop' onClick={onClose} />
      <div className='usermenu-panel'>
        <div className='usermenu-head'>
          <UserIcon size='1rem' />
          <div className='usermenu-head-title'>Account</div>
          <div className='usermenu-head-spacer' />
          <div className='usermenu-close' onClick={onClose}>
            <XIcon size='1rem' />
          </div>
        </div>
        {isPrivyMode ? (
          <PrivyAccountSection world={world} onDisconnectWallet={onDisconnectWallet}>
            {renderWorldSection()}
          </PrivyAccountSection>
        ) : (
          <div className='usermenu-scroll'>
            {renderWorldSection()}
          </div>
        )}
      </div>
    </div>
  )
}
