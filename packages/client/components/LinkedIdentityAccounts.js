import { useEffect, useRef, useState } from 'react'

export function LinkedIdentityAccounts() {
  const linking = useRef(null)
  const auth = globalThis.__runtimeAuth
  const [credentials, setCredentials] = useState([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState('')
  const [providers, setProviders] = useState([])
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([auth.linkedCredentials(), auth.identityCapabilities()])
      .then(([data, capabilities]) => {
        if (active) {
          setCredentials(data.credentials)
          setProviders(capabilities.socialProviders || [])
        }
      })
      .catch(e => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
      linking.current?.abort()
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
      {['solana', ...providers].map(provider => (
        <button
          key={provider}
          className='usermenu-btn menu-button menu-label'
          disabled={!!pending}
          onClick={async () => {
            linking.current = new AbortController()
            setPending(provider)
            setError('')
            setNotice('')
            try {
              const data = await (provider === 'solana'
                ? auth.linkSolanaWallet()
                : auth.linkSocialAccount(provider, { signal: linking.current.signal }))
              setCredentials(data.credentials)
              setNotice('Account linked.')
            } catch (e) {
              setError(e.message)
            } finally {
              setPending('')
            }
          }}
        >
          {pending === provider
            ? 'Waiting for approval…'
            : `Link ${provider === 'solana' ? 'Solana wallet' : { twitter: 'X', github: 'GitHub', discord: 'Discord', apple: 'Apple', telegram: 'Telegram' }[provider] || provider}`}
        </button>
      ))}
      {pending && pending !== 'solana' && (
        <button className='usermenu-btn menu-button menu-label' onClick={() => linking.current?.abort()}>
          Cancel linking
        </button>
      )}
      <p>Approve in your wallet or the social sign-in window. Your game stays open.</p>
      {notice && <p role='status'>{notice}</p>}
      {error && (
        <p role='alert' className='player-panel-error'>
          {error}
        </p>
      )}
    </div>
  )
}
