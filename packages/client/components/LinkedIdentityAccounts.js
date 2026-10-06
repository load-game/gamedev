import { useEffect, useState } from 'react'

export function LinkedIdentityAccounts() {
  const auth = globalThis.__runtimeAuth
  const [credentials, setCredentials] = useState([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  useEffect(() => {
    let active = true
    auth
      .linkedCredentials()
      .then(data => {
        if (active) setCredentials(data.credentials)
      })
      .catch(e => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [auth])
  return (
    <div className='player-panel-stack'>
      <div className='usermenu-section-label'>Linked accounts</div>
      {credentials.map((credential, index) => (
        <div className='usermenu-muted mono' key={index}>
          {credential.kind === 'wallet'
            ? `${credential.family === 'solana' ? 'Solana' : 'EVM'} · ${credential.address}`
            : credential.provider || credential.kind}
        </div>
      ))}
      <button
        className='usermenu-btn menu-button menu-label'
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError('')
          try {
            await auth.manageLinkedAccounts()
          } catch (e) {
            setError(e.message)
            setPending(false)
          }
        }}
      >
        Manage linked accounts
      </button>
      <p>Link wallets and social accounts in Peezy Identity, then return to refresh them here.</p>
      {error && (
        <p role='alert' className='player-panel-error'>
          {error}
        </p>
      )}
    </div>
  )
}
