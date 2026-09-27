import { useCallback, useEffect, useState } from 'react'
import { UserIcon } from 'lucide-react'
import { PlayerPanel } from './PlayerPanel.js'

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
  return (
    <PlayerPanel
      world={world}
      title='Account!'
      icon={UserIcon}
      compact
      onClose={continueAsGuest}
      dismissible={!pending && sessionState.phase === 'idle'}
    >
      <div className='player-panel-stack'>
        <button
          className='menu-button primary menu-label'
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
          className='menu-button menu-label'
          onClick={continueAsGuest}
          disabled={pending || sessionState.phase !== 'idle'}
        >
          Continue as guest
        </button>

        {error && (
          <p className='player-panel-error' role='alert'>
            {error}
          </p>
        )}
      </div>
    </PlayerPanel>
  )
}
