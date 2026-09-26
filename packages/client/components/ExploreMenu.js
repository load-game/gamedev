import { css } from '@firebolt-dev/css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckIcon, GlobeIcon, LoaderIcon, SearchIcon, UserPlusIcon, UsersIcon, XIcon } from 'lucide-react'
import { PlayerPanel } from './PlayerPanel.js'

function resolveWorldServiceApiBase() {
  const configuredAuthUrl =
    typeof globalThis?.env?.PUBLIC_AUTH_URL === 'string' ? globalThis.env.PUBLIC_AUTH_URL.trim() : ''
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

export function ExploreMenu({ world, open, onClose }) {
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
        const friendsFailure = !friendsRes.ok ? getApiError(friendsRes.body, 'Failed to load friends.') : ''
        const requestsFailure = !requestsRes.ok ? getApiError(requestsRes.body, 'Failed to load requests.') : ''
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
        setFriendsNotice(
          response.body?.outcome === 'already_requested' ? 'Request already pending.' : 'Friend request sent.'
        )
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

  const handleAcceptRequest = useCallback(
    async requestId => {
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
    },
    [acceptingRequestId, refreshFriends]
  )

  const handleUnfriend = useCallback(
    async friendUserId => {
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
    },
    [refreshFriends, unfriendingUserId]
  )

  if (!open) return null

  return (
    <PlayerPanel world={world} title='Explore!' icon={GlobeIcon} onClose={onClose}>
      <div
        className='explore-menu'
        css={css`
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          .explore-controls {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }
          .explore-tabs {
            display: flex;
            gap: 0.75rem;
          }
          .explore-tab {
            flex: 1;
          }
          .explore-tab svg {
            width: 1.25rem;
            height: 1.25rem;
          }
          .explore-search {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }
          .explore-search > svg {
            width: 1.25rem;
            height: 1.25rem;
            flex: none;
          }
          .explore-clear {
            display: flex;
            background: none;
            border: 0;
            padding: 0.75rem;
          }
          .explore-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1rem;
          }
          .explore-card {
            display: flex;
            flex-direction: column;
            gap: 0.875rem;
            min-width: 0;
            padding: 1rem;
            border: 2px solid var(--menu-border, #343846);
            border-radius: var(--menu-radius, 8px);
            background: var(--menu-card, #101820);
            color: inherit;
            text-decoration: none;
          }
          .explore-card:hover {
            border-color: var(--menu-muted, #82919e);
          }
          .explore-card-img-wrap {
            aspect-ratio: 16 / 9;
            overflow: hidden;
            border-radius: 6px;
            background: #264c43;
          }
          .explore-card-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .explore-card-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 0.5rem;
            flex-wrap: wrap;
          }
          .explore-card-name {
            font-size: 1.65rem;
            overflow-wrap: anywhere;
          }
          .explore-card-players,
          .friends-notice {
            color: var(--menu-primary-top, #92c0fa);
          }
          .explore-status,
          .friends-empty {
            padding: 1rem 0;
            color: var(--menu-muted, #bed0db);
          }
          .explore-error {
            color: #ffb4aa;
            font-family: sans-serif;
            text-transform: none;
            overflow-wrap: anywhere;
          }
          .friends-layout,
          .friends-section,
          .friends-list,
          .friends-add-card {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }
          .friends-add-row,
          .friends-row {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }
          .friends-add-input {
            flex: 1;
          }
          .friends-row {
            padding: 1rem;
            background: var(--menu-card, #101820);
            border: 2px solid var(--menu-border, #343846);
            border-radius: var(--menu-radius, 8px);
            flex-wrap: wrap;
          }
          .friends-row-main {
            flex: 1;
            min-width: 0;
            overflow-wrap: anywhere;
          }
          .friends-row-name {
            font-size: 1.25rem;
          }
          .friends-row-meta {
            color: var(--menu-muted, #bed0db);
            margin-top: 0.25rem;
          }
          .friends-action-btn {
            min-height: 2.75rem;
            font-size: 1.125rem;
          }
          .friends-add-title,
          .friends-section-title {
            color: var(--menu-header-top, #bed0db);
            font-size: 1.5rem;
          }
          .friends-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1rem;
          }
          @media (max-width: 640px) {
            .explore-grid,
            .friends-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      >
        <div className='explore-controls'>
          <div className='explore-tabs'>
            <button
              className='explore-tab menu-button menu-label'
              aria-pressed={tab === 'worlds'}
              onClick={() => setTab('worlds')}
            >
              <GlobeIcon size='0.75rem' />
              Worlds
            </button>
            <button
              className='explore-tab menu-button menu-label'
              aria-pressed={tab === 'friends'}
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
                className='explore-search-input menu-input'
                aria-label='Search worlds'
                placeholder='Search worlds...'
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && (
                <button className='explore-clear' aria-label='Clear search' onClick={() => setQuery('')}>
                  <XIcon size='1rem' />
                </button>
              )}
            </div>
          ) : (
            <div className='explore-head-spacer' />
          )}
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
              {!loading && error && (
                <div className='explore-error' role='alert'>
                  {error}
                </div>
              )}
              {!loading && !error && worlds.length === 0 && <div className='explore-status'>No worlds found.</div>}
              {!loading && !error && worlds.length > 0 && filtered.length === 0 && (
                <div className='explore-status'>No results for "{query}".</div>
              )}
              {!loading && !error && filtered.length > 0 && (
                <div className='explore-grid'>
                  {filtered.map(world => (
                    <a
                      key={world.id || world.slug}
                      className='explore-card'
                      href={`/${world.slug}`}
                      aria-label={`Play ${world.name || world.slug}`}
                    >
                      <div className='explore-card-img-wrap'>
                        <img
                          className='explore-card-img'
                          src={world.image || '/placeholder-room.png'}
                          alt=''
                          onError={e => {
                            e.currentTarget.src = '/placeholder-room.png'
                          }}
                        />
                      </div>
                      <div className='explore-card-overlay' />
                      <div className='explore-card-info'>
                        <div className='explore-card-footer'>
                          <div className='explore-card-meta'>
                            <div className='explore-card-name menu-label'>{world.name || world.slug}</div>
                          </div>
                          {playerCounts[world.slug] != null && (
                            <div className='explore-card-players'>
                              <div className='explore-card-players-dot' />
                              {playerCounts[world.slug]} online
                            </div>
                          )}
                        </div>
                      </div>
                      <span className='menu-button primary menu-label'>Play</span>
                    </a>
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
                <div className='explore-status'>Sign in from Account to manage friends.</div>
              )}

              {!friendsLoading && friendsAuthed && (
                <div className='friends-layout'>
                  <div className='friends-add-card'>
                    <div className='friends-add-title'>Add Friend By Name</div>
                    <div className='friends-add-row'>
                      <input
                        className='friends-add-input menu-input'
                        aria-label='Friend name'
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
                        className='friends-add-btn menu-button primary menu-label'
                        disabled={!friendName.trim() || addingFriend}
                        onClick={() => {
                          void handleAddFriend()
                        }}
                      >
                        {addingFriend ? <LoaderIcon size='0.8rem' /> : <UserPlusIcon size='0.8rem' />}
                        {addingFriend ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                    {friendsNotice && (
                      <div className='friends-notice' role='status'>
                        {friendsNotice}
                      </div>
                    )}
                    {friendsError && (
                      <div className='explore-error' role='alert'>
                        {friendsError}
                      </div>
                    )}
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
                            </div>
                            <button
                              className='friends-action-btn menu-button menu-label'
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
                              </div>
                              <button
                                className='friends-action-btn menu-button primary menu-label'
                                disabled={acceptingRequestId === request.request_id}
                                onClick={() => {
                                  void handleAcceptRequest(request.request_id)
                                }}
                              >
                                {acceptingRequestId === request.request_id ? (
                                  <LoaderIcon size='0.8rem' />
                                ) : (
                                  <CheckIcon size='0.8rem' />
                                )}
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
    </PlayerPanel>
  )
}
