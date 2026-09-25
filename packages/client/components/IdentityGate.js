import { useEffect, useState } from 'react'

export function IdentityGate({ children }) {
  const [session, setSession] = useState(undefined)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    globalThis.__runtimeAuth.getSessionUser().then(value => {
      if (active) setSession(value)
    })
    return () => {
      active = false
    }
  }, [])
  if (session?.user?.id) return children
  async function signIn() {
    setPending(true)
    setError('')
    try {
      setSession(await globalThis.__runtimeAuth.connectWalletSession())
    } catch (error) {
      setError(error.message || 'Sign-in cancelled. Try again.')
    } finally {
      setPending(false)
    }
  }
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: '#10181a',
        color: '#f3eee3',
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
      }}
    >
      <section style={{ maxWidth: 420, width: '100%' }}>
        <p style={{ color: '#9cbaaa', letterSpacing: '0.12em', fontSize: 12 }}>PRIVATE PLAYTEST</p>
        <h1 style={{ fontSize: 44, letterSpacing: '-0.04em', margin: '16px 0' }}>Welcome back.</h1>
        <p style={{ color: '#b8c3c0', lineHeight: 1.6 }}>Connect a wallet linked to your account to enter the city.</p>
        <button
          onClick={signIn}
          disabled={pending || session === undefined}
          style={{
            width: '100%',
            marginTop: 24,
            padding: 16,
            borderRadius: 6,
            border: 0,
            background: '#c3dfaf',
            color: '#142117',
            fontSize: 16,
            fontWeight: 650,
            cursor: 'pointer',
          }}
        >
          {session === undefined ? 'Checking session…' : pending ? 'Confirm in your wallet…' : 'Connect wallet'}
        </button>
        <p style={{ color: '#92a39c', fontSize: 13, lineHeight: 1.6 }}>
          Sign a message to log in. No transaction or gas fee.
        </p>
        {error && (
          <p role='alert' style={{ color: '#f1ada3', lineHeight: 1.5 }}>
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
