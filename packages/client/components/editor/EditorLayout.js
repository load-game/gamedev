import { css } from '@firebolt-dev/css'
import { useContext, useEffect, useState } from 'react'
import { editorTheme as theme } from './editorTheme.js'
import { MenuRow } from '../MenuRow.js'
import { EditorUserMenu } from '../UserMenu.js'
import { ExploreMenu } from '../ExploreMenu.js'
import { LeftPanel } from './LeftPanel.js'
import { RightPanel } from './RightPanel.js'
import { BottomPanel } from './BottomPanel.js'
import { HintContext, HintProvider } from '../Hint.js'
import { useRank } from '../useRank.js'
import { IdentityOverlay } from '../IdentityOverlay.js'
import { useWalletAuth } from '../useWalletAuth.js'
import { WalletConnectPopover } from '../WalletConnectPopover.js'

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
    const uiEl = world.pointer.ui
    if (!uiEl) return
    const updateVisibility = () => {
      for (const child of uiEl.children) {
        if (child.tagName === 'CANVAS') {
          child.style.display = showEditor ? 'none' : ''
        }
      }
    }
    updateVisibility()
    const observer = new MutationObserver(updateVisibility)
    observer.observe(uiEl, { childList: true })
    return () => observer.disconnect()
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
    if (walletAuth.mode === 'identity') {
      world.emit('identity-login')
      return
    }
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
            <EditorHint visible={showEditor} />
            {/* Toolbar - logo always visible when ready, hammer only for builders */}
            {ready && (
              <MenuRow
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
                world={world}
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
            {ready && walletAuth.mode === 'identity' && <IdentityOverlay world={world} />}
            {ready && <ExploreMenu world={world} open={exploreMenuOpen} onClose={() => setExploreMenuOpen(false)} />}
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

function EditorHint({ visible }) {
  const { hint, setHint } = useContext(HintContext)
  useEffect(() => {
    if (!visible && hint) setHint(null)
  }, [visible])
  if (!visible || !hint) return null
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
