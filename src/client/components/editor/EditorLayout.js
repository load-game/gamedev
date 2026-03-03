import { css } from '@firebolt-dev/css'
import { useContext, useEffect, useState } from 'react'
import { editorTheme as theme } from './editorTheme'
import { EditorToolbar } from './EditorToolbar'
import { EditorUserMenu } from '../UserMenu'
import { ExploreMenu } from '../ExploreMenu'
import { LeftPanel } from './LeftPanel'
import { RightPanel } from './RightPanel'
import { BottomPanel } from './BottomPanel'
import { HintContext, HintProvider } from '../Hint'
import { useRank } from '../useRank'
import { useWalletAuth } from '../useWalletAuth'

export function EditorLayout({ world, ui, children }) {
  const [ready, setReady] = useState(false)
  const [player, setPlayer] = useState(() => world.entities.player)
  const { isBuilder } = useRank(world, player)
  const [open, setOpen] = useState(true)
  const [buildMode, setBuildMode] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [exploreMenuOpen, setExploreMenuOpen] = useState(false)
  const [walletPickerOpen, setWalletPickerOpen] = useState(false)
  const { walletAuth, connectWallet, disconnectWallet } = useWalletAuth(world)
  const isPrivyAuth = walletAuth.mode === 'privy'
  const hasApp = !!ui.app

  useEffect(() => {
    const onReady = () => {
      setReady(true)
      setPlayer(world.entities.player)
    }
    const onPlayer = p => setPlayer(p)
    const onBuildMode = enabled => {
      setBuildMode(enabled)
      if (enabled) {
        setOpen(true)
      } else {
        setOpen(false)
        world.ui.setApp(null)
      }
    }
    world.on('ready', onReady)
    world.on('player', onPlayer)
    world.on('build-mode', onBuildMode)
    return () => {
      world.off('ready', onReady)
      world.off('player', onPlayer)
      world.off('build-mode', onBuildMode)
    }
  }, [])

  useEffect(() => {
    if (ui.app && !open) setOpen(true)
  }, [ui.app])

  useEffect(() => {
    if (isPrivyAuth) return
    if (!walletAuth.connected && userMenuOpen) {
      setUserMenuOpen(false)
    }
  }, [isPrivyAuth, walletAuth.connected, userMenuOpen])

  useEffect(() => {
    if (isPrivyAuth || walletAuth.connected) {
      setWalletPickerOpen(false)
    }
  }, [isPrivyAuth, walletAuth.connected])

  const showEditor = ready && isBuilder && open && buildMode

  useEffect(() => {
    world.ui.toggleVisible(!showEditor)
  }, [showEditor])
  const showRight = showEditor && hasApp
  const showBottom = showEditor && hasApp
  const showWalletPicker = ready && walletPickerOpen && !isPrivyAuth && !walletAuth.connected
  const onUserClick = () => {
    if (walletAuth.pending) return
    if (isPrivyAuth || walletAuth.connected) {
      setWalletPickerOpen(false)
      setUserMenuOpen(true)
      return
    }
    setUserMenuOpen(false)
    setWalletPickerOpen(prev => !prev)
  }
  const connectWalletWithSelection = selection => {
    if (walletAuth.pending) return
    setWalletPickerOpen(false)
    void connectWallet(selection)
  }

  return (
    <HintProvider>
      <div
        className='editor-layout'
        css={css`
          position: absolute;
          inset: 0;
          display: flex;
          overflow: hidden;
        `}
      >
        {/* Left panel */}
        {showEditor && <LeftPanel world={world} />}

        {/* Center column: viewport + bottom panel */}
        <div
          className='editor-center'
          css={css`
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
            position: relative;
          `}
        >
          {/* Viewport area - children (the 3D viewport divs) go here */}
          <div
            className='editor-viewport'
            css={css`
              flex: 1;
              position: relative;
              min-height: 0;
              overflow: hidden;
            `}
          >
            {children}
            <EditorHint />
            {/* Toolbar - logo always visible when ready, hammer only for builders */}
            {ready && (
              <EditorToolbar
                world={world}
                open={open}
                onToggle={() => setOpen(!open)}
                buildMode={buildMode}
                auth={walletAuth}
                onUserClick={onUserClick}
                onExploreClick={() => setExploreMenuOpen(true)}
              />
            )}
            {showWalletPicker && (
              <WalletConnectPopover
                auth={walletAuth}
                onClose={() => setWalletPickerOpen(false)}
                onSelect={connectWalletWithSelection}
              />
            )}
            {ready && (
              <EditorUserMenu
                open={userMenuOpen}
                auth={walletAuth}
                world={world}
                onClose={() => setUserMenuOpen(false)}
                onDisconnectWallet={disconnectWallet}
              />
            )}
            {ready && (
              <ExploreMenu
                open={exploreMenuOpen}
                onClose={() => setExploreMenuOpen(false)}
              />
            )}
          </div>

          {/* Bottom panel */}
          {showBottom && <BottomPanel world={world} />}
        </div>

        {/* Right panel */}
        {showRight && <RightPanel world={world} />}
      </div>
    </HintProvider>
  )
}

function WalletConnectPopover({ auth, onClose, onSelect }) {
  const availability = auth?.providerAvailability || {
    ethereum: !!auth?.providerAvailable,
    solana: false,
  }

  const options = [
    {
      key: 'ethereum',
      label: 'Ethereum',
      available: !!availability.ethereum,
      selection: { chain: 'ethereum' },
    },
    {
      key: 'solana-mainnet',
      label: 'Solana',
      available: !!availability.solana,
      selection: { chain: 'solana', network: 'mainnet' },
    },
  ]

  return (
    <div
      className='editor-wallet-picker'
      css={css`
        position: absolute;
        top: calc(4.1rem + env(safe-area-inset-top));
        left: calc(1rem + env(safe-area-inset-left));
        width: 13rem;
        background: ${theme.bgPanel};
        border: 1px solid ${theme.border};
        border-radius: ${theme.radius};
        backdrop-filter: blur(8px);
        z-index: 12;
        pointer-events: auto;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
        .editor-wallet-picker-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.625rem 0.75rem 0.5rem;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.85);
          letter-spacing: 0.01em;
        }
        .editor-wallet-picker-close {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.65);
          cursor: pointer;
          user-select: none;
          &:hover {
            color: white;
          }
        }
        .editor-wallet-picker-actions {
          padding: 0.25rem 0.5rem 0.625rem;
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .editor-wallet-picker-btn {
          height: 2.2rem;
          border: 1px solid ${theme.border};
          border-radius: ${theme.radiusSmall};
          background: rgba(255, 255, 255, 0.02);
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          text-align: left;
          padding: 0 0.625rem;
          &:hover {
            background: ${theme.bgHover};
          }
          &.disabled {
            cursor: default;
            color: rgba(255, 255, 255, 0.45);
            border-color: ${theme.borderLight};
            background: transparent;
          }
        }
      `}
    >
      <div className='editor-wallet-picker-head'>
        <span>Connect wallet</span>
        <span className='editor-wallet-picker-close' onClick={() => onClose?.()}>
          Close
        </span>
      </div>
      <div className='editor-wallet-picker-actions'>
        {options.map(option => {
          const disabled = auth?.pending || !option.available
          return (
            <button
              key={option.key}
              className={`editor-wallet-picker-btn${disabled ? ' disabled' : ''}`}
              type='button'
              onClick={() => {
                if (disabled) return
                onSelect?.(option.selection)
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EditorHint() {
  const { hint } = useContext(HintContext)
  if (!hint) return null
  return (
    <div
      css={css`
        position: absolute;
        bottom: 0.5rem;
        left: 50%;
        transform: translateX(-50%);
        width: 50%;
        max-height: 70%;
        overflow: auto;
        z-index: 5;
        pointer-events: none;
        background: ${theme.bgPanel};
        border: 1px solid ${theme.border};
        backdrop-filter: blur(5px);
        border-radius: ${theme.radius};
        padding: 0.625rem 0.75rem;
        font-size: 0.8125rem;
      `}
    >
      <span>{hint}</span>
    </div>
  )
}
