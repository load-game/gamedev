import { css } from '@firebolt-dev/css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDownIcon, LoaderIcon, LogOutIcon, UserIcon } from 'lucide-react'
import { useActiveWallet, useLinkAccount, useLogin, usePrivy, useWallets } from '@privy-io/react-auth'
import { PlayerPanel } from './PlayerPanel.js'
import { cls } from './cls.js'

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
  const configuredAuthUrl =
    typeof globalThis?.env?.PUBLIC_AUTH_URL === 'string' ? globalThis.env.PUBLIC_AUTH_URL.trim() : ''
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

function formatWorldRegionLabel(region) {
  if (typeof region !== 'string') return 'Unknown Region'
  const normalized = region.trim().toLowerCase()
  if (!normalized) return 'Unknown Region'
  if (normalized === 'euc' || normalized === 'euc1') return 'Europe'
  if (normalized === 'use' || normalized === 'use1') return 'US East'
  return normalized.toUpperCase()
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
  return user?.email?.address || user?.google?.email || user?.discord?.email || user?.github?.email || null
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
  return wallets.slice().sort((a, b) => {
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

  const linkedWallets = useMemo(() => {
    if (!user || !Array.isArray(user.linkedAccounts)) return []
    return user.linkedAccounts.filter(
      account => account?.type === 'wallet' && typeof account?.address === 'string' && account.address
    )
  }, [user])

  const connectedEvmWallets = useMemo(() => {
    if (!Array.isArray(connectedWallets)) return []
    return connectedWallets.filter(
      wallet => wallet?.type === 'ethereum' && typeof wallet?.address === 'string' && wallet.address
    )
  }, [connectedWallets])

  const connectedSolanaWallets = useMemo(() => {
    if (!Array.isArray(connectedWallets)) return []
    return connectedWallets.filter(
      wallet => wallet?.type === 'solana' && typeof wallet?.address === 'string' && wallet.address
    )
  }, [connectedWallets])

  const activeEvmWallet = useMemo(() => {
    const runtimeAddress = normalizeWalletAddress(runtimeResolvedWallet?.address || '', 'ethereum')
    if (runtimeResolvedWallet?.connected && runtimeAddress) {
      const runtimeMatch = connectedEvmWallets.find(wallet =>
        sameWalletAddress(wallet.address, runtimeAddress, 'ethereum')
      )
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
    [clearFeedback, setFeedbackError]
  )

  const runLinkWallet = useCallback(
    chain => {
      const options =
        chain === 'solana'
          ? { walletChainType: 'solana-only', description: 'Link a Solana wallet (Phantom, Backpack, etc).' }
          : { walletChainType: 'ethereum-only', description: 'Link an Ethereum wallet to this user.' }
      runLinkAction(`wallet-${chain}`, () => linkWallet(options))
    },
    [linkWallet, runLinkAction]
  )

  const copyWalletAddress = useCallback(
    async key => {
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
    },
    [connectedSiteWalletRows, setFeedbackError]
  )

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
        transferAsset === 'USDC' ? await world.evm.getUSDCBalance(address) : await world.evm.getNativeBalance(address)
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
  }, [transferPending, world, transferTo, transferAmount, transferAsset, refreshTransferBalance, setFeedbackSuccess])

  const isAuthenticated = ready && authenticated && user

  const renderWalletsSection = () => {
    const linkingEvm = pendingAction === 'link-wallet-evm'
    const linkingSolana = pendingAction === 'link-wallet-solana'

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
                        className='usermenu-chipbtn menu-button menu-label'
                        disabled={!world?.evm}
                        onClick={() => {
                          openTransferPanel()
                        }}
                      >
                        Send
                      </button>
                    )}
                    <button
                      className='usermenu-chipbtn menu-button menu-label'
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
              <button
                className='usermenu-linkbtn menu-button menu-label'
                disabled={transferPending}
                onClick={closeTransferPanel}
              >
                Close
              </button>
            </div>
            <div className='usermenu-transfer-grid'>
              <label className='usermenu-field'>
                <div className='usermenu-label'>Asset</div>
                <div className='usermenu-select-wrap'>
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
                  <ChevronDownIcon className='usermenu-select-icon' size='0.95rem' strokeWidth={2.1} />
                </div>
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
                  className='usermenu-input menu-input'
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
                    className='usermenu-linkbtn menu-button menu-label'
                    onClick={() => {
                      void copyTransferTxHash()
                    }}
                  >
                    {copiedTxHash ? 'Copied' : 'Copy Tx'}
                  </button>
                  <a
                    className='usermenu-linkbtn menu-button menu-label'
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
                className='usermenu-linkbtn menu-button menu-label'
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
                  className='usermenu-linkbtn menu-button menu-label'
                  disabled={linkingEvm}
                  onClick={() => {
                    if (linkingEvm) return
                    runLinkWallet('evm')
                  }}
                >
                  {linkingEvm ? 'Linking...' : 'EVM'}
                </button>
                <button
                  className='usermenu-linkbtn menu-button menu-label'
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
                      <span className='usermenu-linked-handle'>
                        {provider.handle ? `@${provider.handle}` : 'Linked'}
                      </span>
                    ) : (
                      <button
                        className='usermenu-linkbtn menu-button menu-label'
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
          <button className='usermenu-btn menu-button menu-label' onClick={runLogin}>
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
          className={cls('usermenu-btn menu-button menu-label danger', { disabled: signingOut })}
          disabled={signingOut}
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
          <div
            className={cls('usermenu-feedback', {
              success: feedback.type === 'success',
              error: feedback.type === 'error',
            })}
          >
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
  const canManageWorld = !!auth?.authenticated && auth?.mode !== 'identity'

  const [loadingWorld, setLoadingWorld] = useState(false)
  const [ownedWorlds, setOwnedWorlds] = useState([])
  const [worldError, setWorldError] = useState('')
  const [worldName, setWorldName] = useState('')
  const [worldSlug, setWorldSlug] = useState('')
  const [worldDescription, setWorldDescription] = useState('')
  const [worldRegions, setWorldRegions] = useState([])
  const [defaultWorldRegion, setDefaultWorldRegion] = useState('')
  const [selectedWorldRegion, setSelectedWorldRegion] = useState('')
  const [loadingWorldRegions, setLoadingWorldRegions] = useState(false)
  const [worldRegionsError, setWorldRegionsError] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [createError, setCreateError] = useState('')
  const [creatingWorld, setCreatingWorld] = useState(false)
  const [createWorldOpen, setCreateWorldOpen] = useState(false)

  const refreshOwnedWorlds = useCallback(async () => {
    if (!apiBaseUrl) {
      setOwnedWorlds([])
      setWorldError('World service API is unavailable.')
      return
    }
    setLoadingWorld(true)
    setWorldError('')
    const result = await requestJson(`${apiBaseUrl}/my/worlds`, { method: 'GET' })
    setLoadingWorld(false)
    if (!result.ok) {
      if (result.status === 401) {
        setOwnedWorlds([])
        setWorldError('Session expired. Please sign in again.')
        return
      }
      setOwnedWorlds([])
      setWorldError(getErrorMessage(result.body, 'Unable to load your world.'))
      return
    }
    const owned = Array.isArray(result.body?.owned) ? result.body.owned : []
    setOwnedWorlds(owned)
  }, [apiBaseUrl])

  const refreshWorldRegions = useCallback(async () => {
    if (!apiBaseUrl) {
      setWorldRegions([])
      setDefaultWorldRegion('')
      setSelectedWorldRegion('')
      setWorldRegionsError('World service API is unavailable.')
      return
    }
    setLoadingWorldRegions(true)
    setWorldRegionsError('')
    const result = await requestJson(`${apiBaseUrl}/worlds/regions`, { method: 'GET' })
    setLoadingWorldRegions(false)
    if (!result.ok) {
      setWorldRegions([])
      setDefaultWorldRegion('')
      setSelectedWorldRegion('')
      setWorldRegionsError(getErrorMessage(result.body, 'Unable to load world regions.'))
      return
    }

    const nextRegions = Array.isArray(result.body?.regions)
      ? [
          ...new Set(
            result.body.regions
              .filter(region => typeof region === 'string' && region.trim())
              .map(region => region.trim().toLowerCase())
          ),
        ]
      : []
    const nextDefaultRegion =
      typeof result.body?.defaultRegion === 'string' && result.body.defaultRegion.trim()
        ? result.body.defaultRegion.trim().toLowerCase()
        : ''

    setWorldRegions(nextRegions)
    setDefaultWorldRegion(nextDefaultRegion)
    setSelectedWorldRegion(currentRegion => {
      if (currentRegion && nextRegions.includes(currentRegion)) return currentRegion
      if (nextDefaultRegion && nextRegions.includes(nextDefaultRegion)) return nextDefaultRegion
      return nextRegions[0] || ''
    })
  }, [apiBaseUrl])

  useEffect(() => {
    if (!open) return
    setCreateError('')
    setCreateWorldOpen(false)
    if (!canManageWorld) {
      setLoadingWorld(false)
      setOwnedWorlds([])
      setWorldError('')
      setLoadingWorldRegions(false)
      setWorldRegions([])
      setDefaultWorldRegion('')
      setSelectedWorldRegion('')
      setWorldRegionsError('')
      return
    }
    void refreshOwnedWorlds()
    void refreshWorldRegions()
  }, [open, canManageWorld, refreshOwnedWorlds, refreshWorldRegions])

  useEffect(() => {
    if (slugEdited) return
    setWorldSlug(slugify(worldName))
  }, [worldName, slugEdited])

  const createWorld = async () => {
    if (creatingWorld || loadingWorld || loadingWorldRegions) return
    if (!apiBaseUrl) {
      setCreateError('World service API is unavailable.')
      return
    }
    const normalizedName = worldName.trim()
    const normalizedSlug = slugify(worldSlug)
    const normalizedDescription = worldDescription.trim()
    const normalizedRegion = typeof selectedWorldRegion === 'string' ? selectedWorldRegion.trim().toLowerCase() : ''
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
    if (!normalizedRegion) {
      setCreateError('World region is required.')
      return
    }
    setCreateError('')
    setCreatingWorld(true)
    const result = await requestJson(`${apiBaseUrl}/worlds`, {
      method: 'POST',
      body: JSON.stringify({
        slug: normalizedSlug,
        name: normalizedName,
        region: normalizedRegion,
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
      if (result.status === 409 && code.toLowerCase().includes('slug')) {
        setCreateError('That slug is already in use.')
        return
      }
      setCreateError(getErrorMessage(result.body, 'Unable to create world.'))
      return
    }
    const created = result.body?.world || null
    if (created) {
      setOwnedWorlds(existing => {
        const next = Array.isArray(existing) ? existing.filter(world => world?.id !== created?.id) : []
        return [created, ...next]
      })
      setCreateWorldOpen(false)
      setWorldName('')
      setWorldSlug('')
      setWorldDescription('')
      setSlugEdited(false)
      setCreateError('')
      return
    }
    await refreshOwnedWorlds()
  }

  const openWorld = slugValue => {
    const slug = typeof slugValue === 'string' ? slugValue.trim() : ''
    if (!slug) return
    window.location.href = `/${slug}`
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

    return (
      <>
        {worldError && !ownedWorlds.length ? (
          <div className='usermenu-hero'>
            <div className='usermenu-section-label'>World</div>
            <div className='usermenu-error'>{worldError}</div>
          </div>
        ) : null}
        {ownedWorlds.length ? (
          <div className='usermenu-hero usermenu-hero--worlds'>
            <div className='usermenu-section-label'>Your Worlds</div>
            <div className='usermenu-world-list'>
              {ownedWorlds.map(worldEntry => {
                const slug = typeof worldEntry?.slug === 'string' ? worldEntry.slug.trim() : ''
                const name =
                  typeof worldEntry?.name === 'string' && worldEntry.name.trim() ? worldEntry.name : 'Untitled World'
                const description = typeof worldEntry?.description === 'string' ? worldEntry.description.trim() : ''
                const key = worldEntry?.id || slug || name
                return (
                  <div className='usermenu-world-card' key={key}>
                    <div className='usermenu-world-copy'>
                      <div className='usermenu-hero-name'>{name}</div>
                      {slug ? <div className='usermenu-hero-slug'>/{slug}</div> : null}
                      {description ? (
                        <div className='usermenu-muted usermenu-world-description'>{description}</div>
                      ) : null}
                    </div>
                    <div className='usermenu-hero-actions'>
                      <button
                        className='usermenu-btn-enter menu-button menu-label primary'
                        disabled={!slug}
                        onClick={() => openWorld(slug)}
                      >
                        Enter
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {worldError ? <div className='usermenu-error'>{worldError}</div> : null}
          </div>
        ) : null}
        <div className='usermenu-hero'>
          <div className='usermenu-section-label'>
            {ownedWorlds.length ? 'Create Another World' : 'Create Your World'}
          </div>
          <div className='usermenu-hero-actions'>
            {!createWorldOpen ? (
              <button
                className={cls('usermenu-btn-primary menu-button menu-label primary', { disabled: loadingWorld })}
                disabled={loadingWorld}
                onClick={() => {
                  if (loadingWorld) return
                  setCreateError('')
                  setCreateWorldOpen(true)
                }}
              >
                {ownedWorlds.length ? 'New World' : 'Create World'}
              </button>
            ) : (
              <>
                <button
                  className={cls('usermenu-btn-primary menu-button menu-label primary', {
                    disabled: creatingWorld || loadingWorld || loadingWorldRegions,
                  })}
                  disabled={creatingWorld || loadingWorld || loadingWorldRegions}
                  onClick={() => {
                    if (creatingWorld || loadingWorld || loadingWorldRegions) return
                    void createWorld()
                  }}
                >
                  {creatingWorld && <LoaderIcon size='0.85rem' />}
                  {creatingWorld ? 'Creating...' : 'Create World'}
                </button>
                <button
                  className={cls('usermenu-btn-secondary menu-button menu-label', { disabled: creatingWorld })}
                  disabled={creatingWorld}
                  onClick={() => {
                    if (creatingWorld) return
                    setCreateWorldOpen(false)
                    setCreateError('')
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
          {createWorldOpen ? (
            <>
              <label className='usermenu-field'>
                <div className='usermenu-label'>Name</div>
                <input
                  className='usermenu-input menu-input'
                  value={worldName}
                  maxLength={100}
                  placeholder='My World'
                  onChange={event => setWorldName(event.target.value)}
                />
              </label>
              <label className='usermenu-field'>
                <div className='usermenu-label'>Slug</div>
                <input
                  className='usermenu-input menu-input'
                  value={worldSlug}
                  maxLength={32}
                  placeholder='my-world'
                  onChange={event => {
                    setSlugEdited(true)
                    setWorldSlug(slugify(event.target.value))
                  }}
                />
              </label>
              <label className='usermenu-field'>
                <div className='usermenu-label'>Description (optional)</div>
                <textarea
                  className='usermenu-textarea menu-input'
                  value={worldDescription}
                  maxLength={1000}
                  placeholder='What this world is for'
                  onChange={event => setWorldDescription(event.target.value)}
                />
              </label>
              <label className='usermenu-field'>
                <div className='usermenu-label'>Region</div>
                <div className='usermenu-select-wrap'>
                  <select
                    className='usermenu-input usermenu-select'
                    value={selectedWorldRegion}
                    disabled={creatingWorld || loadingWorldRegions || worldRegions.length === 0}
                    onChange={event => {
                      setSelectedWorldRegion(event.target.value)
                      setCreateError('')
                    }}
                  >
                    {loadingWorldRegions ? <option value=''>Loading regions...</option> : null}
                    {!loadingWorldRegions && worldRegions.length === 0 ? (
                      <option value=''>No regions available</option>
                    ) : null}
                    {!loadingWorldRegions
                      ? worldRegions.map(region => (
                          <option key={region} value={region}>
                            {formatWorldRegionLabel(region)}
                            {region === defaultWorldRegion ? ' (Default)' : ''}
                          </option>
                        ))
                      : null}
                  </select>
                  <ChevronDownIcon className='usermenu-select-icon' size='0.95rem' strokeWidth={2.1} />
                </div>
              </label>
              {worldRegionsError ? <div className='usermenu-error'>{worldRegionsError}</div> : null}
              {createError && <div className='usermenu-error'>{createError}</div>}
            </>
          ) : null}
        </div>
      </>
    )
  }

  if (!open) return null

  return (
    <PlayerPanel world={world} title='Account!' icon={UserIcon} compact onClose={onClose}>
      <div
        className='usermenu'
        css={css`
          display: flex;
          flex-direction: column;
          gap: 1rem;
          .usermenu-scroll,
          .usermenu-section,
          .usermenu-hero {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            min-width: 0;
          }
          .usermenu-divider {
            height: 2px;
            background: var(--menu-border, #343846);
          }
          .usermenu-section-label {
            font-size: 1.5rem;
            color: var(--menu-header-top, #bed0db);
          }
          .usermenu-subsection-label {
            color: var(--menu-muted, #bed0db);
            font-size: 1rem;
          }
          .usermenu-hero-name {
            font-size: 1.375rem;
            overflow-wrap: anywhere;
          }
          .usermenu-world-list,
          .usermenu-rows {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }
          .usermenu-world-card,
          .usermenu-row,
          .usermenu-transfer-panel {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 0.75rem;
            padding: 1rem;
            border: 2px solid var(--menu-border, #343846);
            border-radius: var(--menu-radius, 8px);
            background: var(--menu-card, #101820);
          }
          .usermenu-world-copy,
          .usermenu-footer-identity {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 0.375rem;
          }
          .usermenu-world-description,
          .usermenu-feedback,
          .usermenu-error,
          .usermenu-muted {
            overflow-wrap: anywhere;
          }
          .usermenu-hero-actions,
          .usermenu-inlineactions,
          .usermenu-wallet-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 0.5rem;
          }
          .usermenu-row-value {
            min-width: 0;
          }
          .usermenu-row-label,
          .usermenu-footer-name {
            font-size: 1.25rem;
            overflow-wrap: anywhere;
          }
          .usermenu-btn,
          .usermenu-linkbtn,
          .usermenu-chipbtn {
            min-height: 2.75rem;
            font-size: 1.125rem;
            text-decoration: none;
          }
          .usermenu-chip {
            padding: 0.375rem 0.5rem;
            color: var(--menu-muted, #bed0db);
          }
          .usermenu-chip.active {
            color: var(--menu-primary-top, #92c0fa);
          }
          .usermenu-transfer-panel {
            flex-direction: column;
            align-items: stretch;
          }
          .usermenu-transfer-head,
          .usermenu-transfer-tx,
          .usermenu-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 0.75rem;
          }
          .usermenu-transfer-grid {
            display: flex;
            flex-direction: column;
            gap: 0.875rem;
          }
          .usermenu-field {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          .usermenu-label {
            color: var(--menu-muted, #bed0db);
          }
          .usermenu-select-wrap {
            position: relative;
          }
          .usermenu-select {
            appearance: none;
            padding-right: 2.2rem;
            cursor: pointer;
          }
          .usermenu-select option {
            background: #15252e;
            color: white;
          }
          .usermenu-select-icon {
            position: absolute;
            top: 50%;
            right: 0.75rem;
            transform: translateY(-50%);
            pointer-events: none;
          }
          .usermenu-textarea {
            min-height: 5rem;
            resize: vertical;
          }
          .usermenu-footer {
            border-top: 2px solid var(--menu-border, #343846);
            padding-top: 1rem;
          }
          .usermenu-muted,
          .usermenu-hero-slug,
          .usermenu-linked-handle,
          .usermenu-transfer-meta,
          .usermenu-footer-email {
            color: var(--menu-muted, #bed0db);
          }
          .mono,
          .usermenu-hero-slug,
          .usermenu-footer-email,
          .usermenu-linked-handle,
          .usermenu-transfer-meta {
            font-family: ui-monospace, monospace;
            font-size: 1rem;
            text-transform: none;
            overflow-wrap: anywhere;
          }
          .usermenu-feedback,
          .usermenu-error,
          .usermenu-world-description {
            font-family: sans-serif;
            text-transform: none;
          }
          .usermenu-feedback.success {
            color: var(--menu-primary-top, #92c0fa);
          }
          .usermenu-feedback.error,
          .usermenu-error {
            color: #ffb4aa;
          }
          .menu-button.disabled {
            opacity: 0.5;
            cursor: default;
          }
          @media (max-width: 600px) {
            .usermenu-wallet-row {
              justify-content: flex-start;
            }
            .usermenu-row,
            .usermenu-world-card {
              padding: 0.75rem;
            }
          }
        `}
      >
        {auth?.mode === 'identity' ? (
          <div className='usermenu-hero'>
            <div className='usermenu-section-label'>{world.network.identity?.name || 'Player'}</div>
            <div className='usermenu-muted mono'>
              {auth.address?.slice(0, 6)}…{auth.address?.slice(-4)}
            </div>
            <button
              className='usermenu-btn menu-button menu-label'
              disabled={auth.pending}
              onClick={onDisconnectWallet}
            >
              Sign out
            </button>
          </div>
        ) : isPrivyMode ? (
          <PrivyAccountSection world={world} onDisconnectWallet={onDisconnectWallet}>
            {renderWorldSection()}
          </PrivyAccountSection>
        ) : (
          <div className='usermenu-scroll'>{renderWorldSection()}</div>
        )}
      </div>
    </PlayerPanel>
  )
}
