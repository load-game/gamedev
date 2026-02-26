import { css } from '@firebolt-dev/css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckIcon,
  GlobeIcon,
  LoaderIcon,
  SearchIcon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { editorTheme as theme } from './editor/editorTheme'

function resolveWorldServiceApiBase() {
  const configuredAuthUrl = typeof globalThis?.env?.PUBLIC_AUTH_URL === 'string' ? globalThis.env.PUBLIC_AUTH_URL.trim() : ''
  if (configuredAuthUrl) {
    return configuredAuthUrl.replace(/\/+$/, '').replace(/\/identity$/, '')
  }
  return 'https://dev.lobby.ws'
}

async function requestJson(url, options = {}) {
  const hasBody = typeof options.body === 'string'
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(hasBody ? { 'content-type': 'application/json' } : null),
      ...(options.headers || null),
    },
    ...options,
  })
  const body = await response.json().catch(() => null)
  return { ok: response.ok, status: response.status, body }
}

function getApiError(body, fallback) {
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (message) return message
  const error = typeof body?.error === 'string' ? body.error.trim() : ''
  if (error) return error
  return fallback
}

async function fetchPlayerCount(apiBase, slug) {
  try {
    const statusRes = await fetch(`${apiBase}/worlds/${slug}/status`, { headers: { accept: 'application/json' } })
    if (!statusRes.ok) return null
    const statusData = await statusRes.json()
    const connUrl = statusData?.connection?.url
    if (!connUrl) return null
    const runtimeBase = connUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://')
    const runtimeRes = await fetch(`${runtimeBase}/status`, { headers: { accept: 'application/json' } })
    if (!runtimeRes.ok) return null
    const runtimeData = await runtimeRes.json()
    return typeof runtimeData?.playerCount === 'number' ? runtimeData.playerCount : null
  } catch {
    return null
  }
}

export function ExploreMenu({ open, onClose }) {
  const [tab, setTab] = useState('worlds')

  const [worlds, setWorlds] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [playerCounts, setPlayerCounts] = useState({})

  const [friends, setFriends] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [outgoingRequests, setOutgoingRequests] = useState([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [friendsError, setFriendsError] = useState('')
  const [friendsNotice, setFriendsNotice] = useState('')
  const [friendsAuthed, setFriendsAuthed] = useState(true)
  const [friendName, setFriendName] = useState('')
  const [addingFriend, setAddingFriend] = useState(false)
  const [acceptingRequestId, setAcceptingRequestId] = useState('')
  const [unfriendingUserId, setUnfriendingUserId] = useState('')

  const searchRef = useRef(null)

  const refreshFriends = useCallback(async (apiBase, options = {}) => {
    const { silent = false, keepNotice = false } = options
    if (!silent) setFriendsLoading(true)
    setFriendsError('')
    if (!keepNotice) setFriendsNotice('')

    try {
      const [friendsRes, requestsRes] = await Promise.all([
        requestJson(`${apiBase}/friends`),
        requestJson(`${apiBase}/friends/requests`),
      ])

      if (friendsRes.status === 401 || requestsRes.status === 401) {
        setFriendsAuthed(false)
        setFriends([])
        setIncomingRequests([])
        setOutgoingRequests([])
        setFriendsLoading(false)
        return
      }

      if (!friendsRes.ok || !requestsRes.ok) {
        const friendsFailure = !friendsRes.ok
          ? getApiError(friendsRes.body, 'Failed to load friends.')
          : ''
        const requestsFailure = !requestsRes.ok
          ? getApiError(requestsRes.body, 'Failed to load requests.')
          : ''
        setFriendsError(friendsFailure || requestsFailure || 'Failed to load friend data.')
        setFriendsLoading(false)
        return
      }

      setFriendsAuthed(true)
      setFriends(Array.isArray(friendsRes.body?.friends) ? friendsRes.body.friends : [])
      setIncomingRequests(Array.isArray(requestsRes.body?.incoming) ? requestsRes.body.incoming : [])
      setOutgoingRequests(Array.isArray(requestsRes.body?.outgoing) ? requestsRes.body.outgoing : [])
      setFriendsLoading(false)
    } catch {
      setFriendsError('Failed to load friend data.')
      setFriendsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    setTab('worlds')
    setQuery('')
    setError('')
    setWorlds([])
    setPlayerCounts({})
    setLoading(true)

    setFriends([])
    setIncomingRequests([])
    setOutgoingRequests([])
    setFriendsLoading(true)
    setFriendsError('')
    setFriendsNotice('')
    setFriendsAuthed(true)
    setFriendName('')
    setAddingFriend(false)
    setAcceptingRequestId('')
    setUnfriendingUserId('')

    setTimeout(() => searchRef.current?.focus(), 50)

    const apiBase = resolveWorldServiceApiBase()
    if (!apiBase) {
      setLoading(false)
      setFriendsLoading(false)
      setError('World service unavailable.')
      setFriendsError('World service unavailable.')
      return
    }

    let cancelled = false

    void refreshFriends(apiBase)

    fetch(`${apiBase}/worlds`, { credentials: 'include', headers: { accept: 'application/json' } })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const list = Array.isArray(data?.worlds) ? data.worlds : []
        setWorlds(list)
        setLoading(false)
        const BATCH = 8
        const run = async () => {
          for (let i = 0; i < list.length; i += BATCH) {
            await Promise.allSettled(
              list.slice(i, i + BATCH).map(async w => {
                const count = await fetchPlayerCount(apiBase, w.slug)
                if (count === null || cancelled) return
                setPlayerCounts(prev => ({ ...prev, [w.slug]: count }))
              })
            )
          }
        }
        void run()
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load worlds.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, refreshFriends])

  useEffect(() => {
    if (!open || tab !== 'worlds') return
    const timer = setTimeout(() => searchRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [open, tab])

  useEffect(() => {
    if (!open) return
    const onKeyDown = e => {
      if (e.code === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? worlds.filter(w => (w.name || '').toLowerCase().includes(q) || (w.slug || '').toLowerCase().includes(q))
      : [...worlds]
    return list.sort((a, b) => (playerCounts[b.slug] ?? -1) - (playerCounts[a.slug] ?? -1))
  }, [worlds, query, playerCounts])

  const handleAddFriend = useCallback(async () => {
    const targetName = friendName.trim()
    if (!targetName || addingFriend) return

    const apiBase = resolveWorldServiceApiBase()
    if (!apiBase) {
      setFriendsError('World service unavailable.')
      return
    }

    setAddingFriend(true)
    setFriendsError('')
    setFriendsNotice('')

    try {
      const response = await requestJson(`${apiBase}/friends/requests`, {
        method: 'POST',
        body: JSON.stringify({ target_name: targetName }),
      })

      if (response.ok) {
        setFriendName('')
        setFriendsNotice(response.body?.outcome === 'already_requested' ? 'Request already pending.' : 'Friend request sent.')
        await refreshFriends(apiBase, { silent: true, keepNotice: true })
        return
      }

      if (response.status === 404 && response.body?.error === 'user_not_found') {
        setFriendsError('No user found with that name.')
        return
      }
      if (response.status === 400 && response.body?.error === 'cannot_friend_self') {
        setFriendsError('You cannot add yourself.')
        return
      }
      if (response.status === 409 && response.body?.error === 'incoming_request_exists') {
        setFriendsNotice('This user already requested you. Accept it below.')
        await refreshFriends(apiBase, { silent: true, keepNotice: true })
        return
      }
      if (response.status === 409 && response.body?.error === 'already_friends') {
        setFriendsNotice('You are already friends.')
        await refreshFriends(apiBase, { silent: true, keepNotice: true })
        return
      }

      setFriendsError(getApiError(response.body, 'Unable to send friend request.'))
    } catch {
      setFriendsError('Unable to send friend request.')
    } finally {
      setAddingFriend(false)
    }
  }, [addingFriend, friendName, refreshFriends])

  const handleAcceptRequest = useCallback(async requestId => {
    if (!requestId || acceptingRequestId) return

    const apiBase = resolveWorldServiceApiBase()
    if (!apiBase) {
      setFriendsError('World service unavailable.')
      return
    }

    setAcceptingRequestId(requestId)
    setFriendsError('')
    setFriendsNotice('')

    try {
      const response = await requestJson(`${apiBase}/friends/requests/${requestId}/accept`, {
        method: 'POST',
      })
      if (response.ok) {
        setFriendsNotice('Friend request accepted.')
        await refreshFriends(apiBase, { silent: true, keepNotice: true })
        return
      }

      if (response.status === 404 && response.body?.error === 'request_not_found') {
        setFriendsError('Friend request not found.')
      } else if (response.status === 409 && response.body?.error === 'cannot_accept_own_request') {
        setFriendsError('You cannot accept your own request.')
      } else {
        setFriendsError(getApiError(response.body, 'Unable to accept request.'))
      }
    } catch {
      setFriendsError('Unable to accept request.')
    } finally {
      setAcceptingRequestId('')
    }
  }, [acceptingRequestId, refreshFriends])

  const handleUnfriend = useCallback(async friendUserId => {
    if (!friendUserId || unfriendingUserId) return

    const apiBase = resolveWorldServiceApiBase()
    if (!apiBase) {
      setFriendsError('World service unavailable.')
      return
    }

    setUnfriendingUserId(friendUserId)
    setFriendsError('')
    setFriendsNotice('')

    try {
      const response = await requestJson(`${apiBase}/friends/${friendUserId}`, {
        method: 'DELETE',
      })
      if (response.status === 204) {
        setFriendsNotice('Friend removed.')
        await refreshFriends(apiBase, { silent: true, keepNotice: true })
        return
      }

      if (response.status === 404 && response.body?.error === 'friendship_not_found') {
        setFriendsError('Friendship not found.')
      } else if (response.status === 409 && response.body?.error === 'not_friends') {
        setFriendsError('That user is not in your accepted friends list.')
      } else {
        setFriendsError(getApiError(response.body, 'Unable to remove friend.'))
      }
    } catch {
      setFriendsError('Unable to remove friend.')
    } finally {
      setUnfriendingUserId('')
    }
  }, [refreshFriends, unfriendingUserId])

  if (!open) return null

  return (
    <div
      className='explore-menu'
      css={css`
        position: absolute;
        inset: 0;
        z-index: 100;
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        .explore-backdrop {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(15px);
        }
        .explore-panel {
          position: relative;
          z-index: 1;
          width: 52rem;
          max-width: calc(100% - 2rem);
          max-height: calc(100% - 2rem);
          display: flex;
          flex-direction: column;
          background: ${theme.bgPanel};
          border: 1px solid ${theme.border};
          border-radius: ${theme.radius};
          overflow: hidden;
        }
        .explore-head {
          min-height: 3.5rem;
          padding: 0.65rem 0.75rem 0.65rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          border-bottom: 1px solid ${theme.borderLight};
          flex-shrink: 0;
          color: rgba(255, 255, 255, 0.6);
        }
        .explore-head-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        .explore-head-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
        }
        .explore-tabs {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.2rem;
          border: 1px solid ${theme.border};
          border-radius: ${theme.radiusSmall};
          background: ${theme.bgInput};
          flex-shrink: 0;
        }
        .explore-tab {
          border: none;
          cursor: pointer;
          padding: 0.35rem 0.6rem;
          border-radius: calc(${theme.radiusSmall} - 2px);
          color: rgba(255, 255, 255, 0.55);
          background: transparent;
          font-size: 0.75rem;
          font-weight: 600;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .explore-tab:hover {
          color: rgba(255, 255, 255, 0.85);
          background: ${theme.bgHover};
        }
        .explore-tab.active {
          color: rgba(255, 255, 255, 0.95);
          background: rgba(255, 255, 255, 0.1);
        }
        .explore-search {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid ${theme.border};
          border-radius: ${theme.radiusSmall};
          background: ${theme.bgInput};
          padding: 0 0.6rem;
          height: 2rem;
          color: rgba(255, 255, 255, 0.4);
        }
        .explore-search:focus-within {
          border-color: ${theme.borderHover};
          color: rgba(255, 255, 255, 0.6);
        }
        .explore-search-input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          font-size: 0.82rem;
          color: rgba(255, 255, 255, 0.9);
          font-family: inherit;
        }
        .explore-search-input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }
        .explore-head-spacer {
          flex: 1;
        }
        .explore-close {
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: ${theme.radiusSmall};
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          flex-shrink: 0;
        }
        .explore-close:hover {
          color: white;
          background: ${theme.bgHover};
        }
        .explore-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 1rem;
        }
        .explore-status {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.4);
          padding: 2rem 0;
          text-align: center;
        }
        .explore-error {
          font-size: 0.85rem;
          color: #ff8e8e;
          padding: 0.5rem 0;
          text-align: left;
        }
        .explore-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }
        @media (max-width: 640px) {
          .explore-head {
            padding: 0.65rem;
            gap: 0.45rem;
            flex-wrap: wrap;
          }
          .explore-head-left {
            width: 100%;
          }
          .explore-tabs {
            order: 2;
          }
          .explore-search,
          .explore-head-spacer {
            width: calc(100% - 2.45rem);
            order: 3;
          }
          .explore-close {
            margin-left: auto;
            order: 1;
          }
          .explore-grid {
            grid-template-columns: 1fr;
          }
        }
        .explore-card {
          position: relative;
          border: 1px solid ${theme.border};
          border-radius: ${theme.radiusSmall};
          overflow: hidden;
          cursor: pointer;
          background: ${theme.bgInput};
          aspect-ratio: 16 / 9;
          display: flex;
          flex-direction: column;
        }
        .explore-card:hover {
          border-color: ${theme.borderHover};
        }
        .explore-card:hover .explore-card-img {
          transform: scale(1.03);
        }
        .explore-card:hover .explore-card-overlay {
          background: linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.18) 55%, transparent 100%);
        }
        .explore-card-img-wrap {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .explore-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.25s ease;
        }
        .explore-card-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.1) 50%, transparent 100%);
          transition: background 0.2s ease;
        }
        .explore-card-info {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 0.65rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .explore-card-name {
          font-size: 0.9rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.95);
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .explore-card-footer {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .explore-card-meta {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          min-width: 0;
        }
        .explore-card-players {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.72rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .explore-card-players-dot {
          width: 0.4rem;
          height: 0.4rem;
          border-radius: 50%;
          background: #6dea8a;
          flex-shrink: 0;
        }
        .friends-layout {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
        }
        .friends-add-card,
        .friends-section {
          border: 1px solid ${theme.border};
          border-radius: ${theme.radiusSmall};
          background: ${theme.bgInput};
          padding: 0.75rem;
        }
        .friends-add-title,
        .friends-section-title {
          font-size: 0.78rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.82);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 0.55rem;
        }
        .friends-add-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .friends-add-input {
          flex: 1;
          border: 1px solid ${theme.border};
          background: rgba(0, 0, 0, 0.2);
          border-radius: ${theme.radiusSmall};
          height: 2rem;
          padding: 0 0.6rem;
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.82rem;
          outline: none;
        }
        .friends-add-input:focus {
          border-color: ${theme.borderHover};
        }
        .friends-add-btn,
        .friends-action-btn {
          border: 1px solid ${theme.border};
          border-radius: ${theme.radiusSmall};
          background: ${theme.bgHover};
          color: rgba(255, 255, 255, 0.9);
          font-size: 0.76rem;
          font-weight: 600;
          padding: 0 0.65rem;
          height: 2rem;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          cursor: pointer;
        }
        .friends-add-btn:hover,
        .friends-action-btn:hover {
          border-color: ${theme.borderHover};
          color: #fff;
        }
        .friends-add-btn:disabled,
        .friends-action-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .friends-action-btn.secondary {
          background: transparent;
        }
        .friends-notice {
          font-size: 0.8rem;
          color: #9ad5ff;
          padding: 0.1rem 0;
        }
        .friends-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .friends-row {
          border: 1px solid ${theme.border};
          border-radius: ${theme.radiusSmall};
          background: rgba(0, 0, 0, 0.2);
          padding: 0.55rem 0.6rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.6rem;
        }
        .friends-row-main {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          min-width: 0;
        }
        .friends-row-name {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.93);
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .friends-row-meta {
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.45);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .friends-empty {
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.45);
          padding: 0.45rem 0.1rem 0.15rem;
        }
        .friends-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }
        @media (max-width: 640px) {
          .friends-grid {
            grid-template-columns: 1fr;
          }
        }
      `}
    >
      <div className='explore-backdrop' onClick={onClose} />
      <div className='explore-panel'>
        <div className='explore-head'>
          <div className='explore-head-left'>
            {tab === 'worlds' ? <GlobeIcon size='1rem' /> : <UsersIcon size='1rem' />}
            <div className='explore-head-title'>Explore</div>
          </div>

          <div className='explore-tabs'>
            <button
              className={`explore-tab ${tab === 'worlds' ? 'active' : ''}`}
              onClick={() => setTab('worlds')}
            >
              <GlobeIcon size='0.75rem' />
              Worlds
            </button>
            <button
              className={`explore-tab ${tab === 'friends' ? 'active' : ''}`}
              onClick={() => setTab('friends')}
            >
              <UsersIcon size='0.75rem' />
              Friends
            </button>
          </div>

          {tab === 'worlds' ? (
            <div className='explore-search'>
              <SearchIcon size='0.8rem' />
              <input
                ref={searchRef}
                className='explore-search-input'
                placeholder='Search worlds...'
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && (
                <XIcon
                  size='0.8rem'
                  style={{ cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => setQuery('')}
                />
              )}
            </div>
          ) : (
            <div className='explore-head-spacer' />
          )}

          <div className='explore-close' onClick={onClose}>
            <XIcon size='1rem' />
          </div>
        </div>

        <div className='explore-body'>
          {tab === 'worlds' && (
            <>
              {loading && (
                <div className='explore-status'>
                  <LoaderIcon size='1rem' style={{ verticalAlign: 'text-bottom', marginRight: '0.4rem' }} />
                  Loading worlds...
                </div>
              )}
              {!loading && error && <div className='explore-error'>{error}</div>}
              {!loading && !error && worlds.length === 0 && <div className='explore-status'>No worlds found.</div>}
              {!loading && !error && worlds.length > 0 && filtered.length === 0 && (
                <div className='explore-status'>No results for "{query}".</div>
              )}
              {!loading && !error && filtered.length > 0 && (
                <div className='explore-grid'>
                  {filtered.map(world => (
                    <div
                      key={world.id || world.slug}
                      className='explore-card'
                      onClick={() => {
                        window.location.href = `/worlds/${world.slug}`
                      }}
                    >
                      <div className='explore-card-img-wrap'>
                        <img
                          className='explore-card-img'
                          src={world.image || '/placeholder-room.png'}
                          alt={world.name || world.slug}
                          onError={e => {
                            e.currentTarget.src = '/placeholder-room.png'
                          }}
                        />
                      </div>
                      <div className='explore-card-overlay' />
                      <div className='explore-card-info'>
                        <div className='explore-card-footer'>
                          <div className='explore-card-meta'>
                            <div className='explore-card-name'>{world.name || world.slug}</div>
                          </div>
                          {playerCounts[world.slug] != null && (
                            <div className='explore-card-players'>
                              <div className='explore-card-players-dot' />
                              {playerCounts[world.slug]}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'friends' && (
            <>
              {friendsLoading && (
                <div className='explore-status'>
                  <LoaderIcon size='1rem' style={{ verticalAlign: 'text-bottom', marginRight: '0.4rem' }} />
                  Loading friends...
                </div>
              )}

              {!friendsLoading && !friendsAuthed && (
                <div className='explore-status'>Sign in from the user menu to manage friends.</div>
              )}

              {!friendsLoading && friendsAuthed && (
                <div className='friends-layout'>
                  <div className='friends-add-card'>
                    <div className='friends-add-title'>Add Friend By Name</div>
                    <div className='friends-add-row'>
                      <input
                        className='friends-add-input'
                        placeholder='friend name'
                        value={friendName}
                        onChange={e => setFriendName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void handleAddFriend()
                          }
                        }}
                      />
                      <button
                        className='friends-add-btn'
                        disabled={!friendName.trim() || addingFriend}
                        onClick={() => {
                          void handleAddFriend()
                        }}
                      >
                        {addingFriend ? <LoaderIcon size='0.8rem' /> : <UserPlusIcon size='0.8rem' />}
                        {addingFriend ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                    {friendsNotice && <div className='friends-notice'>{friendsNotice}</div>}
                    {friendsError && <div className='explore-error'>{friendsError}</div>}
                  </div>

                  <div className='friends-section'>
                    <div className='friends-section-title'>Friends</div>
                    {friends.length === 0 && <div className='friends-empty'>No accepted friends yet.</div>}
                    {friends.length > 0 && (
                      <div className='friends-list'>
                        {friends.map(friend => (
                          <div className='friends-row' key={`friend:${friend.user_id}`}>
                            <div className='friends-row-main'>
                              <div className='friends-row-name'>{friend.name}</div>
                              <div className='friends-row-meta'>ID: {friend.user_id}</div>
                            </div>
                            <button
                              className='friends-action-btn secondary'
                              disabled={unfriendingUserId === friend.user_id}
                              onClick={() => {
                                void handleUnfriend(friend.user_id)
                              }}
                            >
                              {unfriendingUserId === friend.user_id ? 'Removing...' : 'Unfriend'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className='friends-grid'>
                    <div className='friends-section'>
                      <div className='friends-section-title'>Incoming Requests</div>
                      {incomingRequests.length === 0 && <div className='friends-empty'>No incoming requests.</div>}
                      {incomingRequests.length > 0 && (
                        <div className='friends-list'>
                          {incomingRequests.map(request => (
                            <div className='friends-row' key={`incoming:${request.request_id}`}>
                              <div className='friends-row-main'>
                                <div className='friends-row-name'>{request.name}</div>
                                <div className='friends-row-meta'>Request: {request.request_id}</div>
                              </div>
                              <button
                                className='friends-action-btn'
                                disabled={acceptingRequestId === request.request_id}
                                onClick={() => {
                                  void handleAcceptRequest(request.request_id)
                                }}
                              >
                                {acceptingRequestId === request.request_id ? <LoaderIcon size='0.8rem' /> : <CheckIcon size='0.8rem' />}
                                {acceptingRequestId === request.request_id ? 'Accepting...' : 'Accept'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className='friends-section'>
                      <div className='friends-section-title'>Outgoing Requests</div>
                      {outgoingRequests.length === 0 && <div className='friends-empty'>No outgoing requests.</div>}
                      {outgoingRequests.length > 0 && (
                        <div className='friends-list'>
                          {outgoingRequests.map(request => (
                            <div className='friends-row' key={`outgoing:${request.request_id}`}>
                              <div className='friends-row-main'>
                                <div className='friends-row-name'>{request.name}</div>
                                <div className='friends-row-meta'>Pending</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
