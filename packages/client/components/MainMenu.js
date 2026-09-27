import { css } from '@firebolt-dev/css'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CircleArrowRightIcon, HammerIcon, UserXIcon, Volume2Icon, SettingsIcon } from 'lucide-react'
import { MenuButton, SettingsRange, SettingsSelect, SettingsText, SettingsToggle } from './SettingsFields.js'
import { menuStyles, useMenuTheme } from './PlayerMenuTheme.js'
import { ControlPriorities } from '@gamedev/core/extras/ControlPriorities.js'
import { useFullscreen } from './useFullscreen.js'
import { useRank } from './useRank.js'
import { isTouch } from '../utils.js'
import { cls } from './cls.js'
import { theme } from './theme.js'
import { HintContext, HintProvider } from './Hint.js'
import { MicIcon, MicOffIcon } from './Icons.js'
import { sortBy } from 'lodash-es'
import * as THREE from '@gamedev/core/extras/three.js'
import { Ranks } from '@gamedev/core/extras/ranks.js'
import { storage } from '@gamedev/core/storage.js'
import { syncLobbyProfilePatch } from '@gamedev/core/profileSync.js'
import { sanitizeWsUrl } from '@gamedev/core/utils.js'
import { getPreferredServerUrl, resolveConnectionPolicy, navigateToServer } from '@gamedev/core/utils-client.js'

const shadowOptions = [
  { label: 'None', value: 'none' },
  { label: 'Low', value: 'low' },
  { label: 'Med', value: 'med' },
  { label: 'High', value: 'high' },
]

export function MainMenu({ world, open, onClose }) {
  const player = world.entities.player
  const { isAdmin, isBuilder } = useRank(world, player)
  const [name, setName] = useState(() => player.data.name)
  const [dpr, setDPR] = useState(world.prefs.dpr)
  const [shadows, setShadows] = useState(world.prefs.shadows)
  const [postprocessing, setPostprocessing] = useState(world.prefs.postprocessing)
  const [bloom, setBloom] = useState(world.prefs.bloom)
  const [ao, setAO] = useState(world.prefs.ao)
  const [music, setMusic] = useState(world.prefs.music)
  const [sfx, setSFX] = useState(world.prefs.sfx)
  const [voice, setVoice] = useState(world.prefs.voice)
  const [ui, setUI] = useState(world.prefs.ui)
  const [canFullscreen, isFullscreen, toggleFullscreen] = useFullscreen()
  const [actions, setActions] = useState(world.prefs.actions)
  const [stats, setStats] = useState(world.prefs.stats)
  const [tab, setTab] = useState('audio')
  const dialogRef = useRef(null)
  const menuTheme = useMenuTheme(world)
  const changeName = async name => {
    if (!name) return setName(player.data.name)
    const result = await syncLobbyProfilePatch({ name })
    if (!result.ok) {
      world.emit('toast', result.error?.message || 'Unable to update profile')
      return setName(player.data.name)
    }
    player.setName(name)
    setName(name)
  }
  const dprOptions = useMemo(() => {
    const dpr = window.devicePixelRatio
    const options = []
    const add = (label, dpr) => {
      options.push({ label, value: dpr })
    }
    add('0.5x', 0.5)
    add('1x', 1)
    if (dpr >= 2) add('2x', 2)
    if (dpr >= 3) add('3x', dpr)
    return options
  }, [])
  useEffect(() => {
    const onPrefsChange = changes => {
      if (changes.dpr) setDPR(changes.dpr.value)
      if (changes.shadows) setShadows(changes.shadows.value)
      if (changes.postprocessing) setPostprocessing(changes.postprocessing.value)
      if (changes.bloom) setBloom(changes.bloom.value)
      if (changes.ao) setAO(changes.ao.value)
      if (changes.music) setMusic(changes.music.value)
      if (changes.sfx) setSFX(changes.sfx.value)
      if (changes.voice) setVoice(changes.voice.value)
      if (changes.ui) setUI(changes.ui.value)
      if (changes.actions) setActions(changes.actions.value)
      if (changes.stats) setStats(changes.stats.value)
    }
    world.prefs.on('change', onPrefsChange)
    return () => {
      world.prefs.off('change', onPrefsChange)
    }
  }, [])
  useEffect(() => {
    if (!open) return
    setTab('audio')
    const previousFocus = document.activeElement
    const controls = world.controls.bind({ priority: ControlPriorities.CORE_UI })
    controls.escape.capture = true
    controls.escape.onPress = onClose
    controls.pointer.unlock()
    const dialog = dialogRef.current
    dialog?.querySelector('.settings-close')?.focus()
    return () => {
      controls.release()
      previousFocus?.focus?.()
    }
  }, [open, world])
  const handleKeyDown = event => {
    // Keep browser focus/range keys out of the world's Tab and movement handlers.
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
    if (event.key === 'Tab') {
      const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), input, select')]
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }
  if (!open) return null
  const tabs = [
    ['audio', 'Audio'],
    ['interface', 'Interface'],
    ['graphics', 'Graphics'],
    ['player', 'Player'],
    ['connection', 'Connection'],
  ]
  if (isAdmin) tabs.push(['players', 'Players'])
  return (
    <HintProvider>
      <div
        className='mainmenu'
        style={menuTheme}
        css={css`
          ${menuStyles}
          position: absolute;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          .mainmenu-backdrop {
            position: absolute;
            inset: 0;
            background: #05071366;
          }
          .settings-dialog {
            position: relative;
            width: min(69rem, calc(100% - 3rem));
            max-height: calc(100% - 3rem);
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }
          .settings-head {
            display: flex;
            gap: 1rem;
            flex: none;
          }
          .settings-title {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 1rem;
            min-height: 5.5rem;
            padding: 0.75rem 1.5rem;
            margin: 0;
            font-size: clamp(1.8rem, 4vw, 3.5rem);
            font-weight: inherit;
            border: var(--menu-border-width, 1px) solid var(--menu-outline, #303744);
            border-radius: var(--menu-radius, 6px);
            background: linear-gradient(var(--menu-header-top, #354457), var(--menu-header-bottom, #202a38));
            box-shadow: inset 0 4px 0 #ffffffaa;
          }
          .settings-title svg {
            width: 2.75rem;
            height: 2.75rem;
            flex: none;
          }
          .settings-close {
            width: 5.5rem;
            min-height: 5.5rem;
            flex: none;
            font-size: 3.5rem;
            background: linear-gradient(var(--menu-close-top, #b93838), var(--menu-close-bottom, #8b2929));
            box-shadow: inset 0 calc(-1 * var(--menu-button-depth, 0px)) 0 var(--menu-close-shadow, #621818);
          }
          .settings-body {
            min-height: 0;
            display: grid;
            grid-template-columns: 14rem minmax(0, 1fr);
            align-items: start;
            gap: 1.5rem;
            padding: 1.5rem;
            border: 3px solid var(--menu-border, #303744);
            border-radius: var(--menu-radius, 6px);
            background: var(--menu-panel, #141923ee);
            overflow-y: auto;
            scrollbar-width: thin;
          }
          .settings-nav,
          .settings-content {
            display: flex;
            flex-direction: column;
            gap: 0.875rem;
            min-width: 0;
          }
          .settings-nav .menu-button {
            width: 100%;
          }
          .settings-content {
            min-height: 22rem;
          }
          .settings-done {
            width: 100%;
            margin-top: 0.125rem;
          }
          @media (max-width: 680px) {
            .settings-dialog {
              width: calc(100% - 1.25rem);
              max-height: calc(100% - 1.25rem);
              gap: 0.6rem;
            }
            .settings-head {
              gap: 0.6rem;
            }
            .settings-title {
              min-height: 4rem;
              padding: 0.5rem 0.75rem;
              gap: 0.5rem;
            }
            .settings-title svg {
              width: 1.75rem;
              height: 1.75rem;
            }
            .settings-close {
              width: 4rem;
              min-height: 4rem;
              font-size: 2.5rem;
            }
            .settings-body {
              grid-template-columns: minmax(0, 1fr);
              padding: 0.75rem;
              gap: 0.75rem;
            }
            .settings-nav {
              flex-direction: row;
              overflow-x: auto;
              padding-bottom: 0.3rem;
              gap: 0.5rem;
            }
            .settings-nav .menu-button {
              width: auto;
              flex: none;
              font-size: 1rem;
              min-height: 2.75rem;
              padding-inline: 0.7rem;
            }
            .settings-content {
              min-height: 0;
              gap: 0.75rem;
            }
            .menu-card {
              font-size: 1rem;
              padding: 0.75rem;
            }
            .menu-card .menu-button {
              min-width: 5rem;
              font-size: 1rem;
            }
          }
        `}
      >
        <div className='mainmenu-backdrop' onClick={onClose} />
        <section
          ref={dialogRef}
          className='settings-dialog'
          role='dialog'
          aria-modal='true'
          aria-labelledby='settings-title'
          onKeyDown={handleKeyDown}
        >
          <header className='settings-head'>
            <h1 id='settings-title' className='settings-title'>
              <SettingsIcon aria-hidden='true' />
              <span className='menu-label'>Settings!</span>
            </h1>
            <MenuButton className='settings-close' aria-label='Close settings' onClick={onClose}>
              X
            </MenuButton>
          </header>
          <div className='settings-body'>
            <nav className='settings-nav' aria-label='Settings categories'>
              {tabs.map(([id, label]) => (
                <MenuButton key={id} primary={tab === id} aria-pressed={tab === id} onClick={() => setTab(id)}>
                  {label}
                </MenuButton>
              ))}
              {world.xr.isSupported && <MenuButton onClick={() => world.xr.start()}>Enter VR</MenuButton>}
            </nav>
            <div className='settings-content' aria-label={tabs.find(([id]) => id === tab)?.[1]}>
              {tab === 'audio' && (
                <>
                  <SettingsRange label='Music' value={music} onChange={value => world.prefs.setMusic(value)} />
                  <SettingsRange label='Sound Effects' value={sfx} onChange={value => world.prefs.setSFX(value)} />
                  <SettingsRange label='Voice' value={voice} onChange={value => world.prefs.setVoice(value)} />
                </>
              )}
              {tab === 'interface' && (
                <>
                  <SettingsRange
                    label='Interface Scale'
                    min={0.5}
                    max={1.5}
                    step={0.1}
                    value={ui}
                    onChange={value => world.prefs.setUI(value)}
                  />
                  <SettingsToggle
                    label='Fullscreen'
                    value={isFullscreen}
                    disabled={!canFullscreen}
                    onChange={toggleFullscreen}
                  />
                  {isBuilder && (
                    <SettingsToggle
                      label='Build Prompts'
                      value={actions}
                      onChange={value => world.prefs.setActions(value)}
                    />
                  )}
                  <SettingsToggle
                    label='Performance Stats'
                    value={stats}
                    onChange={value => world.prefs.setStats(value)}
                  />
                  {!isTouch && (
                    <div className='menu-card'>
                      <span className='menu-label'>Hide Interface</span>
                      <MenuButton
                        aria-label='Hide interface (Z to show again)'
                        onClick={() => {
                          world.ui.toggleVisible()
                          onClose()
                        }}
                      >
                        Z
                      </MenuButton>
                    </div>
                  )}
                </>
              )}
              {tab === 'graphics' && (
                <>
                  <SettingsSelect
                    label='Resolution'
                    options={dprOptions}
                    value={dpr}
                    onChange={value => world.prefs.setDPR(value)}
                  />
                  <SettingsSelect
                    label='Shadows'
                    options={shadowOptions}
                    value={shadows}
                    onChange={value => world.prefs.setShadows(value)}
                  />
                  <SettingsToggle
                    label='Post-processing'
                    value={postprocessing}
                    onChange={value => world.prefs.setPostprocessing(value)}
                  />
                  <SettingsToggle label='Bloom' value={bloom} onChange={value => world.prefs.setBloom(value)} />
                  {world.settings.ao && (
                    <SettingsToggle label='Ambient Occlusion' value={ao} onChange={value => world.prefs.setAO(value)} />
                  )}
                </>
              )}
              {tab === 'player' && <SettingsText label='Name' value={name} onChange={changeName} />}
              {tab === 'connection' && <ConnectionSection world={world} onClose={onClose} />}
              {tab === 'players' && isAdmin && <PlayersSection world={world} />}
              <MenuButton className='settings-done' primary onClick={onClose}>
                Done
              </MenuButton>
            </div>
          </div>
        </section>
      </div>
    </HintProvider>
  )
}

function ConnectionSection({ world, onClose }) {
  const connectionPolicy = useMemo(() => resolveConnectionPolicy(), [])
  const showServerUrl = connectionPolicy.allowUrlOverride
  const [isOffline, setIsOffline] = useState(() => !!world.network?.isOffline)
  const [ping, setPing] = useState(null)
  const [serverUrl, setServerUrl] = useState(() => getPreferredServerUrl())

  useEffect(() => {
    const onPing = ms => setPing(ms)
    const onDisconnect = () => {
      setIsOffline(true)
      setPing(null)
    }
    const onConnectionStatus = ({ status } = {}) => {
      if (status === 'connected') {
        setIsOffline(false)
        return
      }
      if (status === 'offline') {
        setIsOffline(true)
        setPing(null)
      }
    }
    world.on('ping', onPing)
    world.on('disconnect', onDisconnect)
    world.on('connectionStatus', onConnectionStatus)
    return () => {
      world.off('ping', onPing)
      world.off('disconnect', onDisconnect)
      world.off('connectionStatus', onConnectionStatus)
    }
  }, [world])

  const handleConnect = () => {
    const clean = sanitizeWsUrl(serverUrl)
    if (!clean) {
      world.emit('toast', 'Enter a valid ws:// or wss:// URL')
      return
    }
    onClose?.()
    navigateToServer(clean)
  }

  const handleDisconnect = () => {
    onClose?.()
    world.network?.ws?.close()
  }

  return (
    <>
      {showServerUrl && (
        <SettingsText
          label='Server'
          placeholder='wss://your-world.example/ws'
          value={serverUrl}
          onChange={setServerUrl}
        />
      )}
      <div className='menu-card'>
        <span className='menu-label'>Status</span>
        <span className='menu-status'>{isOffline ? 'Offline' : `Online${ping != null ? ` (${ping}ms)` : ''}`}</span>
      </div>
      <MenuButton onClick={isOffline ? handleConnect : handleDisconnect}>
        {isOffline ? 'Connect' : 'Disconnect'}
      </MenuButton>
    </>
  )
}

function getPlayers(world) {
  let players = []
  world.entities.players.forEach(player => {
    players.push(player)
  })
  players = sortBy(players, player => player.enteredAt)
  return players
}

function PlayersSection({ world }) {
  const { setHint } = useContext(HintContext)
  const localPlayer = world.entities.player
  const isAdmin = localPlayer.isAdmin()
  const [players, setPlayers] = useState(() => getPlayers(world))
  const [livePlayers, setLivePlayers] = useState(() => storage.get('admin-live', false))
  const canToggleLive = !!world.isAdminClient
  useEffect(() => {
    const onChange = () => {
      setPlayers(getPlayers(world))
    }
    world.entities.on('added', onChange)
    world.entities.on('removed', onChange)
    world.livekit.on('speaking', onChange)
    world.livekit.on('muted', onChange)
    world.on('rank', onChange)
    world.on('name', onChange)
    return () => {
      world.entities.off('added', onChange)
      world.entities.off('removed', onChange)
      world.livekit.off('speaking', onChange)
      world.livekit.off('muted', onChange)
      world.off('rank', onChange)
      world.off('name', onChange)
    }
  }, [])
  useEffect(() => {
    if (!world.isAdminClient || !world.network?.setSubscriptions) return
    world.network.setSubscriptions({ snapshot: true, players: livePlayers, runtime: false })
    storage.set('admin-live', livePlayers)
  }, [livePlayers])
  const toggleBuilder = player => {
    if (player.data.rank === Ranks.BUILDER) {
      world.admin.modifyRank(player.data.id, Ranks.VISITOR)
    } else {
      world.admin.modifyRank(player.data.id, Ranks.BUILDER)
    }
  }
  const toggleMute = player => {
    world.admin.mute(player.data.id, !player.isMuted())
  }
  const kick = player => {
    world.admin.kick(player.data.id)
  }
  const teleportTo = player => {
    const position = new THREE.Vector3(0, 0, 1)
    position.applyQuaternion(player.base.quaternion)
    position.multiplyScalar(0.6).add(player.base.position)
    localPlayer.teleport({
      position,
      rotationY: player.base.rotation.y,
    })
  }
  return (
    <div
      className='mainmenu-players'
      css={css`
        .mainmenu-players-head {
          display: flex;
          align-items: center;
          padding: 0 1rem;
          height: 2rem;
        }
        .mainmenu-players-live {
          height: 1.75rem;
          padding: 0 0.625rem;
          border-radius: ${theme.radiusSmall};
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: transparent;
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.75rem;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          white-space: nowrap;
          &:hover {
            cursor: pointer;
            border-color: rgba(255, 255, 255, 0.3);
            color: white;
          }
          &.active {
            border-color: rgba(64, 136, 255, 0.7);
            color: white;
          }
        }
        .mainmenu-players-live-dot {
          width: 0.35rem;
          height: 0.35rem;
          border-radius: ${theme.radiusSmall};
          background: rgba(255, 255, 255, 0.35);
        }
        .mainmenu-players-live.active .mainmenu-players-live-dot {
          background: #4088ff;
        }
        .mainmenu-players-item {
          display: flex;
          align-items: center;
          padding: 0.1rem 0.5rem 0.1rem 1rem;
          height: 2.25rem;
        }
        .mainmenu-players-name {
          flex: 1;
          display: flex;
          align-items: center;
          font-size: 0.9375rem;
          span {
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
            margin-right: 0.5rem;
          }
          svg {
            color: rgba(255, 255, 255, 0.6);
          }
        }
        .mainmenu-players-btn {
          width: 1.75rem;
          height: 1.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.8);
          &:hover {
            cursor: pointer;
            color: white;
          }
          &.dim {
            color: #556181;
          }
        }
      `}
    >
      {canToggleLive && (
        <div className='mainmenu-players-head'>
          <button
            type='button'
            className={cls('mainmenu-players-live', { active: livePlayers })}
            onClick={() => setLivePlayers(!livePlayers)}
            onPointerEnter={() => setHint('Toggle live player overlays')}
            onPointerLeave={() => setHint(null)}
          >
            <span className='mainmenu-players-live-dot' />
            {livePlayers ? 'Live' : 'Live Off'}
          </button>
        </div>
      )}
      {players.map(player => (
        <div className='mainmenu-players-item' key={player.data.id}>
          <div className='mainmenu-players-name'>
            <span>{player.data.name}</span>
            {player.speaking && <Volume2Icon size='0.875rem' />}
            {player.isMuted() && <MicOffIcon size='0.875rem' />}
          </div>
          {isAdmin && player.isRemote && !player.isAdmin() && world.settings.rank < Ranks.BUILDER && (
            <div
              className={cls('mainmenu-players-btn', { dim: !player.isBuilder() })}
              onPointerEnter={() =>
                setHint(
                  player.isBuilder()
                    ? 'Player is not a builder. Click to allow building.'
                    : 'Player is a builder. Click to revoke.'
                )
              }
              onPointerLeave={() => setHint(null)}
              onClick={() => toggleBuilder(player)}
            >
              <HammerIcon size='1rem' />
            </div>
          )}
          {player.isRemote && localPlayer.outranks(player) && (
            <div
              className='mainmenu-players-btn'
              onPointerEnter={() => setHint('Teleport to player.')}
              onPointerLeave={() => setHint(null)}
              onClick={() => teleportTo(player)}
            >
              <CircleArrowRightIcon size='1rem' />
            </div>
          )}
          {player.isRemote && localPlayer.outranks(player) && (
            <div
              className='mainmenu-players-btn'
              onPointerEnter={() =>
                setHint(player.isMuted() ? 'Player is muted. Click to unmute.' : 'Player is not muted. Click to mute.')
              }
              onPointerLeave={() => setHint(null)}
              onClick={() => toggleMute(player)}
            >
              {player.isMuted() ? <MicOffIcon size='1rem' /> : <MicIcon size='1rem' />}
            </div>
          )}
          {player.isRemote && localPlayer.outranks(player) && (
            <div
              className='mainmenu-players-btn'
              onPointerEnter={() => setHint('Kick this player.')}
              onPointerLeave={() => setHint(null)}
              onClick={() => kick(player)}
            >
              <UserXIcon size='1rem' />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
