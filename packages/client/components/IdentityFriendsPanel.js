import { useCallback, useEffect, useRef, useState } from 'react'

export function IdentityFriendsPanel({ world }) {
  const [rows, setRows] = useState([]),
    [tab, setTab] = useState('friends'),
    [handle, setHandle] = useState('')
  const [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(false)
  const alive = useRef(true)
  const signedIn = !!world.network.identity
  const request = useCallback(
    async (method, payload) => {
      if (world.friendsClient) return world.friendsClient.request(method, payload)
      const auth = globalThis.__runtimeAuth
      if (!auth?.friends || method === 'friends-join') throw new Error('Friends are unavailable in this world.')
      const result = await auth.friends(
        method === 'friends-act' ? { action: payload.action, target: payload.address, handle: payload.handle } : {}
      )
      return result.friends.map(row => ({
        address: row.profile.id,
        name: row.profile.displayName,
        handle: row.profile.handle,
        state: row.state,
        presenceAvailable: false,
        online: false,
        sameCity: false,
      }))
    },
    [world]
  )
  const refresh = useCallback(async () => {
    const result = await request('friends-list')
    if (alive.current) {
      setRows(result)
      setLoaded(true)
    }
  }, [request])
  useEffect(() => {
    alive.current = true
    if (!signedIn)
      return () => {
        alive.current = false
      }
    const update = () =>
      refresh().catch(e => {
        if (alive.current) setError(e.message)
      })
    update()
    const timer = setInterval(update, 10000)
    return () => {
      alive.current = false
      clearInterval(timer)
    }
  }, [refresh, signedIn])
  const run = async fn => {
    if (pending) return
    setPending(true)
    setError('')
    try {
      await fn()
      await refresh()
    } catch (e) {
      if (alive.current) setError(e.message)
    } finally {
      if (alive.current) setPending(false)
    }
  }
  const act = (row, action) => run(() => request('friends-act', { address: row.address, action }))
  if (!signedIn)
    return (
      <div className='player-panel-stack'>
        <div className='usermenu-muted'>Sign in with Peezy Identity to use Friends.</div>
        <button className='usermenu-btn menu-button menu-label' onClick={() => world.emit('identity-login')}>
          Sign in
        </button>
      </div>
    )
  const visible = rows.filter(row =>
    tab === 'friends'
      ? row.state === 'friend'
      : tab === 'blocked'
        ? row.state === 'blocked'
        : ['incoming', 'outgoing'].includes(row.state)
  )
  return (
    <div className='player-panel-stack'>
      <div className='player-panel-stack' style={{ flexDirection: 'row' }}>
        {['friends', 'requests', 'blocked'].map(value => (
          <button
            className='usermenu-btn menu-button menu-label'
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <form
        className='player-panel-stack'
        onSubmit={e => {
          e.preventDefault()
          void run(async () => {
            await request('friends-act', {
              action: 'request',
              handle: handle.trim().replace(/^@/, '').toLowerCase(),
            })
            setHandle('')
          })
        }}
      >
        <label className='usermenu-muted'>
          Add by Peezy handle
          <input
            className='usermenu-input mono'
            value={handle}
            maxLength={33}
            placeholder='@handle'
            onChange={e => setHandle(e.target.value)}
          />
        </label>
        <button className='usermenu-btn menu-button menu-label' disabled={pending || !handle.trim()}>
          Send request
        </button>
      </form>
      {error && (
        <div role='alert' className='usermenu-error'>
          {error}
        </div>
      )}
      {!loaded && !error && <div className='usermenu-muted'>Loading friends…</div>}
      {loaded && !visible.length && (
        <div className='usermenu-muted'>
          {tab === 'friends'
            ? 'No friends yet. Add someone by handle or right-click a nearby player.'
            : tab === 'requests'
              ? 'No pending requests.'
              : 'No blocked accounts.'}
        </div>
      )}
      {visible.map(row => (
        <div key={row.address} className='player-panel-stack usermenu-row'>
          <div>
            {row.name}
            {row.handle && <span className='usermenu-muted mono'> @{row.handle}</span>}
          </div>
          <div className='usermenu-muted'>
            {row.state === 'friend'
              ? row.presenceAvailable === false
                ? 'City presence is unavailable here'
                : row.sameCity
                  ? 'In your city'
                  : row.online
                    ? 'Online'
                    : 'Offline'
              : row.state === 'incoming'
                ? 'Incoming request'
                : row.state === 'outgoing'
                  ? 'Request sent'
                  : 'Blocked'}
          </div>
          {row.state === 'friend' && world.achievementsClient && (
            <button
              className='usermenu-btn menu-button menu-label'
              onClick={() => world.emit('account-open', { tab: 'achievements', subject: row.address })}
            >
              View badges
            </button>
          )}
          {row.state === 'friend' && row.online && !row.sameCity && (
            <button
              className='usermenu-btn menu-button menu-label'
              disabled={pending}
              onClick={() =>
                run(async () => world.network.joinFriend(await request('friends-join', { address: row.address })))
              }
            >
              Join city
            </button>
          )}
          {(row.state === 'incoming'
            ? ['accept', 'decline', 'block']
            : row.state === 'outgoing'
              ? ['cancel', 'block']
              : row.state === 'blocked'
                ? ['unblock']
                : ['remove', 'block']
          ).map(action => (
            <button
              key={action}
              className='usermenu-btn menu-button menu-label'
              disabled={pending}
              onClick={() => act(row, action)}
            >
              {action === 'remove' ? 'Unfriend' : action}
            </button>
          ))}
        </div>
      ))}
      <button className='usermenu-btn menu-button menu-label' disabled={pending} onClick={() => run(async () => {})}>
        Refresh friends
      </button>
    </div>
  )
}
