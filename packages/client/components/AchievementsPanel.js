import { useEffect, useRef, useState } from 'react'
export function AchievementsPanel({ world, subject = null }) {
  const [snapshot, setData] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState('all')
  const account = world.network.identity
  const generation = useRef(0)
  const data = snapshot?.actor === account?.userId && snapshot?.view === subject ? snapshot : null
  async function load(payload = {}) {
    const current = generation.current
    setBusy(true)
    setError('')
    try {
      const result = await world.achievementsClient.request(
        payload.action ? 'achievements-visibility' : 'achievements-state',
        {
          ...payload,
          ...(subject ? { viewSubject: subject } : {}),
        }
      )
      if (current === generation.current) setData({ ...result, actor: account.userId, view: subject })
    } catch (e) {
      if (current === generation.current) setError(e.message || 'Achievements unavailable. Retry shortly.')
    } finally {
      if (current === generation.current) setBusy(false)
    }
  }
  useEffect(() => {
    generation.current++
    setData(null)
    setError('')
    setBusy(false)
    setFilter('all')
    if (!account) return
    let active = true
    const refresh = async () => {
      try {
        const result = await world.achievementsClient.request(
          'achievements-state',
          subject ? { viewSubject: subject } : {}
        )
        if (active) {
          setData({ ...result, actor: account.userId, view: subject })
          setError('')
        }
      } catch (e) {
        if (active) setError(e.message || 'Achievements unavailable.')
      }
    }
    void refresh()
    const timer = setInterval(refresh, 15000)
    return () => {
      generation.current++
      active = false
      clearInterval(timer)
    }
  }, [world, account?.userId, subject])
  if (!account)
    return (
      <div className='player-panel-stack'>
        <div>Sign in with Peezy Identity to save achievements.</div>
        <button className='menu-button menu-label' onClick={() => world.emit('identity-login')}>
          Sign in
        </button>
      </div>
    )
  const rows = data?.achievements || [],
    groups = [...new Set(rows.map(r => r.group))]
  return (
    <div className='player-panel-stack' style={{ textTransform: 'none', gap: '0.75rem' }}>
      <div>
        {data?.publicView
          ? `${rows.length} showcased badges`
          : `${rows.filter(r => r.earnedAt && !r.optional).length} / ${rows.filter(r => !r.optional).length} achievements earned`}
        {data?.environment ? ` · ${data.environment}` : ''}
      </div>
      {!data?.publicView && (
        <div className='usermenu-muted'>Progress is private. Choose which earned badges to showcase.</div>
      )}
      {data?.verificationPending && (
        <div role='status'>Some activity checks are unavailable. Saved progress is retained.</div>
      )}
      {data?.publicView && !rows.length && <div>No badges showcased.</div>}
      {data?.syncPending && <div role='status'>Saved in game. Identity sync pending; refresh to retry.</div>}
      <label>
        Category{' '}
        <select className='menu-input' value={filter} onChange={e => setFilter(e.target.value)}>
          <option value='all'>All</option>
          <option value='earned'>Earned</option>
          {groups.map(g => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>
      {error && <div role='alert'>{error}</div>}
      <button className='menu-button menu-label' disabled={busy} onClick={() => load()}>
        Refresh achievements
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {rows
          .filter(r => filter === 'all' || (filter === 'earned' && r.earnedAt) || r.group === filter)
          .map(r => (
            <div key={r.id} style={{ borderBottom: '1px solid var(--menu-border, #343846)', paddingBottom: '0.75rem' }}>
              <div style={{ fontSize: '1.125rem' }}>
                {r.title}
                {r.earnedAt ? ' ✓' : ''}
              </div>
              <div className='usermenu-muted' style={{ fontFamily: 'sans-serif' }}>
                {r.description}
              </div>
              <div style={{ fontFamily: 'sans-serif', fontSize: '0.9rem' }}>
                {r.earnedAt
                  ? `Earned ${new Date(r.earnedAt).toLocaleDateString()}`
                  : `${Math.min(r.progress || 0, r.target)} / ${r.target}`}
                {r.season ? ` · ${r.season}` : ''}
                {r.optional ? ' · Optional' : ''}
              </div>
              {r.earnedAt && !data?.publicView && (
                <button
                  className='menu-button menu-label'
                  disabled={busy || !r.synced}
                  onClick={() => load({ action: 'visibility', key: r.id, public: !r.public })}
                >
                  {r.public ? 'Hide badge' : 'Showcase badge'}
                </button>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
