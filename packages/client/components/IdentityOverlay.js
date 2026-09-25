import { css } from '@firebolt-dev/css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { XIcon, UserIcon } from 'lucide-react'
import { ControlPriorities } from '@gamedev/core/extras/ControlPriorities.js'
import { editorTheme as theme } from './editor/editorTheme.js'

export function IdentityOverlay({ world }) {
  const auth = globalThis.__runtimeAuth
  const [open, setOpen] = useState(() => !world.network.identity && auth.shouldOfferSignIn())
  const [sessionState, setSessionState] = useState(auth.getState())
  useEffect(
    () =>
      auth.onStateChange(state => {
        setSessionState(state)
        setOpen(state.phase !== 'idle' || (!world.network.identity && auth.shouldOfferSignIn()))
        setError(state.error)
      }),
    [auth, world]
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const panel = useRef(null)
  const continueAsGuest = useCallback(() => {
    if (sessionState.phase !== 'idle') return
    auth.continueAsGuest()
    setOpen(false)
  }, [auth, sessionState.phase])
  useEffect(() => {
    const show = () => {
      setError('')
      setOpen(true)
    }
    world.on('identity-login', show)
    return () => world.off('identity-login', show)
  }, [world])
  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement
    const control = world.controls.bind({ priority: ControlPriorities.CORE_UI })
    world.controls.releaseAllButtons()
    control.onButtonPress = () => true
    control.pointer.unlock()
    control.hideReticle()
    panel.current?.focus()
    return () => {
      control.release()
      previousFocus?.focus?.()
    }
  }, [open, world])
  if (!open) return null
  async function signIn() {
    setPending(true)
    setError('')
    try {
      if (sessionState.phase === 'error') await auth.retrySession()
      else await auth.connectWalletSession()
    } catch (error) {
      if (!error.skipAuth) setError(error.message || 'Sign-in cancelled. Try again.')
    } finally {
      setPending(false)
    }
  }
  function onKeyDown(event) {
    event.stopPropagation()
    if (event.key === 'Escape' && !pending) {
      event.preventDefault()
      continueAsGuest()
    }
    if (event.key === 'Tab') {
      const buttons = [...panel.current.querySelectorAll('button:not(:disabled)')]
      const first = buttons[0],
        last = buttons.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }
  return (
    <div
      className='identity-overlay'
      css={css`
        position: absolute;
        inset: 0;
        z-index: 110;
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.18);
        .identity-panel {
          width: 26rem;
          max-width: calc(100% - 2rem);
          color: white;
          background: rgba(28, 30, 40, 0.94);
          border: 1px solid ${theme.borderHover};
          border-radius: ${theme.radius};
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3);
        }
        .identity-head {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 1rem;
          border-bottom: 1px solid ${theme.border};
          color: #bbb;
        }
        .identity-close {
          margin-left: auto;
          padding: 0.25rem;
          display: flex;
          background: none;
          color: #bbb;
          border: 0;
          cursor: pointer;
        }
        .identity-body {
          padding: 1.5rem;
        }
        h2 {
          font-size: 1.5rem;
          font-weight: 500;
          margin: 0 0 0.75rem;
        }
        p {
          font-size: 0.9rem;
          line-height: 1.6;
          color: #b7b9c0;
          margin: 0 0 1.5rem;
        }
        .identity-action {
          width: 100%;
          padding: 0.9rem 1rem;
          margin-bottom: 0.65rem;
          cursor: pointer;
          border: 1px solid ${theme.borderHover};
          border-radius: 2px;
          background: ${theme.bgInput};
          color: white;
          font: inherit;
        }
        .identity-primary {
          background: #e5e7ed;
          color: #20222a;
        }
        button:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        button:focus-visible {
          outline: 2px solid #adc4ff;
          outline-offset: 3px;
        }
        .identity-note {
          margin: 0.65rem 0 0;
          font-size: 0.75rem;
        }
        .identity-error {
          color: #ffb4aa;
          margin-top: 1rem;
          margin-bottom: 0;
        }
      `}
    >
      <section
        ref={panel}
        tabIndex={-1}
        className='identity-panel'
        role='dialog'
        aria-modal='true'
        aria-labelledby='identity-title'
        onKeyDown={onKeyDown}
      >
        <div className='identity-head'>
          <UserIcon size={16} />
          <span>Your account</span>
          <button
            className='identity-close'
            aria-label='Continue as guest'
            disabled={pending || sessionState.phase !== 'idle'}
            onClick={continueAsGuest}
          >
            <XIcon size={18} />
          </button>
        </div>
        <div className='identity-body'>
          <h2 id='identity-title'>Welcome to the city</h2>
          <p>Explore as a guest, or connect your wallet to use your account.</p>
          <button
            className='identity-action identity-primary'
            onClick={signIn}
            disabled={pending || sessionState.phase === 'switching'}
          >
            {sessionState.phase === 'switching'
              ? 'Switching accounts…'
              : sessionState.phase === 'error'
                ? 'Retry connection'
                : pending
                  ? 'Confirm in your wallet…'
                  : 'Connect wallet'}
          </button>
          <button
            className='identity-action'
            onClick={continueAsGuest}
            disabled={pending || sessionState.phase !== 'idle'}
          >
            Continue as guest
          </button>
          <p className='identity-note'>You can sign in anytime. No transaction or gas fee.</p>
          {error && (
            <p className='identity-error' role='alert'>
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
