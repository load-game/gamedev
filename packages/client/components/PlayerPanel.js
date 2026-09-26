import { css } from '@firebolt-dev/css'
import { useEffect, useId, useRef } from 'react'
import { ControlPriorities } from '@gamedev/core/extras/ControlPriorities.js'
import { menuStyles, useMenuTheme } from './PlayerMenuTheme.js'

// Shared shell for player-facing menus; world palettes remain optional.
export function PlayerPanel({ world, title, icon: Icon, onClose, dismissible = true, compact = false, children }) {
  const theme = useMenuTheme(world)
  const titleId = useId()
  const panel = useRef(null)
  const close = useRef(null)
  close.current = () => {
    if (dismissible) onClose?.()
  }
  useEffect(() => {
    const previousFocus = document.activeElement
    const controls = world.controls.bind({ priority: ControlPriorities.CORE_UI })
    world.controls.releaseAllButtons()
    controls.onButtonPress = () => true
    controls.escape.capture = true
    controls.escape.onPress = () => close.current()
    controls.pointer.unlock()
    controls.hideReticle()
    panel.current?.focus()
    const recoverFocus = event => {
      // Disabling/removing an async action can leave focus on the document body.
      // Recover before the world's global Tab handler consumes the key.
      if (event.key !== 'Tab' || document.activeElement !== document.body) return
      event.preventDefault()
      event.stopPropagation()
      panel.current?.focus()
    }
    window.addEventListener('keydown', recoverFocus, true)
    return () => {
      window.removeEventListener('keydown', recoverFocus, true)
      controls.release()
      previousFocus?.focus?.()
    }
  }, [world])
  const onKeyDown = event => {
    // External wallet dialogs can use portals; their keyboard events belong to them.
    if (!panel.current.contains(event.target)) return
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      close.current()
    }
    if (event.key !== 'Tab') return
    const elements = [
      ...panel.current.querySelectorAll(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
      ),
    ].filter(element => element.getClientRects().length && !element.closest('[inert]'))
    const first = elements[0]
    const last = elements.at(-1)
    if (!first) {
      event.preventDefault()
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
  return (
    <div
      className='player-panel'
      style={theme}
      css={css`
        ${menuStyles}
        position: absolute;
        inset: 0;
        z-index: 110;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        .player-panel-backdrop {
          position: absolute;
          inset: 0;
          background: #05071366;
        }
        .player-panel-dialog {
          position: relative;
          width: min(69rem, calc(100% - 3rem));
          max-height: calc(100% - 3rem);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          outline: none;
        }
        .player-panel-dialog.compact {
          width: min(44rem, calc(100% - 3rem));
        }
        .player-panel-head {
          display: flex;
          gap: 1rem;
          flex: none;
        }
        .player-panel-title {
          flex: 1;
          min-width: 0;
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
        .compact .player-panel-title {
          font-size: clamp(1.7rem, 4vw, 2.5rem);
        }
        .player-panel-title svg {
          width: 2.75rem;
          height: 2.75rem;
          flex: none;
        }
        .player-panel-close {
          width: 5.5rem;
          min-height: 5.5rem;
          flex: none;
          font-size: 3.5rem;
          background: linear-gradient(var(--menu-close-top, #b93838), var(--menu-close-bottom, #8b2929));
          box-shadow: inset 0 calc(-1 * var(--menu-button-depth, 0px)) 0 var(--menu-close-shadow, #621818);
        }
        .player-panel-body {
          min-height: 0;
          padding: 1.5rem;
          border: 3px solid var(--menu-border, #303744);
          border-radius: var(--menu-radius, 6px);
          background: var(--menu-panel, #141923ee);
          overflow-y: auto;
          scrollbar-width: thin;
          overscroll-behavior: contain;
        }
        .player-panel-stack {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .player-panel-error {
          color: #ffb4aa;
          font-family: sans-serif;
          text-transform: none;
          overflow-wrap: anywhere;
        }
        .menu-input,
        .menu-data {
          font-family: ui-monospace, monospace;
          text-transform: none;
        }
        .menu-input {
          min-width: 0;
          width: 100%;
          padding: 0.875rem 1rem;
          border: 2px solid var(--menu-muted, #82919e);
          border-radius: var(--menu-radius, 6px);
          background: var(--menu-card, #15252e);
          color: var(--menu-text, #fff);
          font-size: 1rem;
        }
        .menu-input::placeholder {
          color: var(--menu-muted, #bed0db);
          opacity: 1;
        }
        a:focus-visible,
        textarea:focus-visible {
          outline: 3px solid var(--menu-text, #fff);
          outline-offset: 3px;
        }
        @media (max-width: 600px) {
          .player-panel-dialog,
          .player-panel-dialog.compact {
            width: calc(100% - 1rem);
            max-height: calc(100% - 1rem);
            gap: 0.5rem;
          }
          .player-panel-head {
            gap: 0.5rem;
          }
          .player-panel-title {
            min-height: 4rem;
            padding: 0.5rem 0.75rem;
            gap: 0.5rem;
          }
          .player-panel-title svg {
            width: 1.75rem;
            height: 1.75rem;
          }
          .player-panel-close {
            min-height: 4rem;
            width: 4rem;
            font-size: 2.5rem;
          }
          .player-panel-body {
            padding: 0.875rem;
          }
        }
      `}
    >
      <div className='player-panel-backdrop' onClick={() => close.current()} />
      <section
        ref={panel}
        tabIndex={-1}
        className={`player-panel-dialog${compact ? ' compact' : ''}`}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        onKeyUp={event => {
          if (panel.current.contains(event.target)) event.stopPropagation()
        }}
      >
        <div className='player-panel-head'>
          <h2 id={titleId} className='player-panel-title menu-label'>
            {Icon && <Icon aria-hidden='true' />}
            {title}
          </h2>
          <button
            type='button'
            className='player-panel-close menu-button menu-label'
            aria-label={`Close ${title.replace(/!$/, '')}`}
            disabled={!dismissible}
            onClick={() => close.current()}
          >
            X
          </button>
        </div>
        <div className='player-panel-body'>{children}</div>
      </section>
    </div>
  )
}
