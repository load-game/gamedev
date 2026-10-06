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
    Promise.allSettled([auth.linkedCredentials(), auth.identityCapabilities()])
      .then(([linked, capabilities]) => {
        if (!active) return
        if (linked.status === 'fulfilled') setCredentials(linked.value.credentials)
        else setError(linked.reason.message)
        if (capabilities.status === 'fulfilled') setProviders(capabilities.value.socialProviders || [])
        else setError('Social sign-in options are unavailable. Refresh linked accounts to retry.')
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
      {[
        'solana',
        ...providers.filter(
          provider => !credentials.some(credential => credential.kind === 'social' && credential.provider === provider)
        ),
      ].map(provider => (
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
                ? auth.linkSolanaWallet({ signal: linking.current.signal })
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
      {pending && pending !== 'solana' && pending !== 'refresh' && (
        <button className='usermenu-btn menu-button menu-label' onClick={() => linking.current?.abort()}>
          Cancel linking
        </button>
      )}
      <button
        className='usermenu-btn menu-button menu-label'
        disabled={!!pending}
        onClick={async () => {
          setPending('refresh')
          setError('')
          setNotice('')
          try {
            const linked = await auth.linkedCredentials()
            setCredentials(linked.credentials)
            const capabilities = await auth.identityCapabilities()
            setProviders(capabilities.socialProviders || [])
          } catch (e) {
            setError(e.message)
          } finally {
            setPending('')
          }
        }}
      >
        Refresh linked accounts
      </button>
      <button
        className='usermenu-linkbtn menu-button menu-label'
        disabled={!!pending}
        onClick={async () => {
          setError('')
          try {
            await auth.manageLinkedAccounts()
          } catch (e) {
            setError(e.message)
          }
        }}
      >
        Account settings
      </button>
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
