import { css } from '@firebolt-dev/css'
import { useEffect, useState } from 'react'
import { FieldFile, FieldNumber, FieldSwitch, FieldText, FieldToggle } from '../Fields'
import { useRank } from '../useRank'
import { Ranks } from '../../../core/extras/ranks'
import { theme } from '../theme'
import { Pane } from './Pane'

const voiceChatOptions = [
  { label: 'Disabled', value: 'disabled' },
  { label: 'Spatial', value: 'spatial' },
  { label: 'Global', value: 'global' },
]

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function getWorldPlayerLimitCap() {
  const fromProcess = parsePositiveInt(globalThis?.process?.env?.PUBLIC_WORLD_MAX_PLAYERS)
  if (fromProcess > 0) return fromProcess
  return parsePositiveInt(globalThis?.env?.PUBLIC_WORLD_MAX_PLAYERS)
}

function normalizeCredentialValue(value) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function resolveWorldUrl() {
  const href = typeof globalThis?.location?.href === 'string' ? globalThis.location.href : ''
  if (!href) return ''
  try {
    const url = new URL(href)
    let path = url.pathname.replace(/\/admin\/?$/, '') || '/'
    if (path !== '/') path = path.replace(/\/$/, '')
    return path === '/' ? url.origin : `${url.origin}${path}`
  } catch {
    return ''
  }
}

function buildCredentialsEnvBlock({ worldId, worldUrl }) {
  return `WORLD_ID=${normalizeCredentialValue(worldId)}
WORLD_URL=${normalizeCredentialValue(worldUrl)}`
}

function buildCredentialsMarkdown({ worldId, worldUrl }) {
  const envBlock = buildCredentialsEnvBlock({ worldId, worldUrl })
  return `# Runtime Credentials Setup

1. In your current directory, clone \`github.com/lobby-ws/sdk\`:
   \`\`\`bash
   git clone https://github.com/lobby-ws/sdk.git ./
   \`\`\`
2. From the repository root, add these environment variables to \`.env\` in the repository:
   \`\`\`env
   ${envBlock}
   \`\`\`
   Verify the file was written before continuing:
   \`\`\`bash
   cat .env
   \`\`\`
3. From the repository root, authorize the SDK against this world:
   \`\`\`bash
   gamedev auth
   \`\`\`
4. Before any coding agent does work in this SDK repo, require this pre-read from the repository root:
   - Codex: read \`AGENTS.md\`
   - Claude Code: read \`CLAUDE.md\`
   - OpenClaw: read \`skills/lobby-ws/SKILL.md\`
   - Do not start work until the required file is read.
5. Read \`README.md\` in the repository before running commands so you follow the expected setup and scripts.`
}

function formatCredentialError(code) {
  if (code === 'admin_required') return 'Deploy access is required to view runtime credentials.'
  if (code === 'admin_url_missing') return 'Admin endpoint is unavailable for this world.'
  if (code === 'clipboard_unavailable') return 'Clipboard access is unavailable in this browser context.'
  if (code === 'timeout') return 'Timed out requesting runtime credentials.'
  return 'Failed to load runtime credentials.'
}

function formatShutdownError(code) {
  if (code === 'admin_required') return 'Deploy access is required to shut down this world.'
  if (code === 'admin_url_missing') return 'Admin endpoint is unavailable for this world.'
  if (code === 'admin_code_missing') return 'Enter an admin code before requesting shutdown.'
  if (code === 'shutdown_save_failed') return 'Failed to save the world before shutdown.'
  if (code === 'shutdown_request_failed') return 'Failed to request Agones shutdown.'
  if (code === 'shutdown_unavailable') return 'Agones shutdown is unavailable for this runtime.'
  if (code === 'timeout') return 'Timed out requesting shutdown.'
  return 'Failed to request shutdown.'
}

async function copyToClipboard(value) {
  if (value === null || value === undefined || !navigator?.clipboard?.writeText) return false
  await navigator.clipboard.writeText(String(value))
  return true
}

export function World({ world, hidden }) {
  const player = world.entities.player
  const { isAdmin } = useRank(world, player)
  const worldPlayerLimitCap = getWorldPlayerLimitCap()
  const hasPlayerLimitCap = worldPlayerLimitCap > 0
  const [title, setTitle] = useState(world.settings.title)
  const [desc, setDesc] = useState(world.settings.desc)
  const [image, setImage] = useState(world.settings.image)
  const [avatar, setAvatar] = useState(world.settings.avatar)
  const [customAvatars, setCustomAvatars] = useState(world.settings.customAvatars)
  const [voice, setVoice] = useState(world.settings.voice)
  const [playerLimit, setPlayerLimit] = useState(world.settings.playerLimit)
  const [ao, setAO] = useState(world.settings.ao)
  const [rank, setRank] = useState(world.settings.rank)
  const [runtimeCredentials, setRuntimeCredentials] = useState(null)
  const [credentialsLoading, setCredentialsLoading] = useState(false)
  const [credentialsError, setCredentialsError] = useState(null)
  const [copiedCredentials, setCopiedCredentials] = useState(false)
  const [shutdownPending, setShutdownPending] = useState(false)
  const [shutdownRequested, setShutdownRequested] = useState(false)
  const [shutdownError, setShutdownError] = useState(null)

  useEffect(() => {
    const onChange = changes => {
      if (changes.title) setTitle(changes.title.value)
      if (changes.desc) setDesc(changes.desc.value)
      if (changes.image) setImage(changes.image.value)
      if (changes.avatar) setAvatar(changes.avatar.value)
      if (changes.customAvatars) setCustomAvatars(changes.customAvatars.value)
      if (changes.voice) setVoice(changes.voice.value)
      if (changes.playerLimit) setPlayerLimit(changes.playerLimit.value)
      if (changes.ao) setAO(changes.ao.value)
      if (changes.rank) setRank(changes.rank.value)
    }
    world.settings.on('change', onChange)
    return () => {
      world.settings.off('change', onChange)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin || !world.admin?.getRuntimeCredentials) {
      setRuntimeCredentials(null)
      setCredentialsLoading(false)
      setCredentialsError(null)
      return
    }
    let active = true
    setCredentialsLoading(true)
    setCredentialsError(null)
    world.admin
      .getRuntimeCredentials()
      .then(credentials => {
        if (!active) return
        setRuntimeCredentials(credentials)
      })
      .catch(err => {
        if (!active) return
        setRuntimeCredentials(null)
        setCredentialsError(err?.code || 'request_failed')
      })
      .finally(() => {
        if (!active) return
        setCredentialsLoading(false)
      })
    return () => {
      active = false
    }
  }, [isAdmin, world])

  useEffect(() => {
    if (!copiedCredentials) return
    const timer = setTimeout(() => setCopiedCredentials(false), 1250)
    return () => clearTimeout(timer)
  }, [copiedCredentials])

  useEffect(() => {
    if (isAdmin) return
    setShutdownPending(false)
    setShutdownRequested(false)
    setShutdownError(null)
  }, [isAdmin])

  const loadRuntimeCredentials = async ({ forceRefresh = false } = {}) => {
    if (!world.admin?.getRuntimeCredentials) return
    setCredentialsLoading(true)
    setCredentialsError(null)
    try {
      const credentials = await world.admin.getRuntimeCredentials({ forceRefresh })
      setRuntimeCredentials(credentials)
      return credentials
    } catch (err) {
      setRuntimeCredentials(null)
      setCredentialsError(err?.code || 'request_failed')
      return null
    } finally {
      setCredentialsLoading(false)
    }
  }

  const copyCredentials = async () => {
    const credentials = runtimeCredentials || (await loadRuntimeCredentials({ forceRefresh: true }))
    if (!credentials) return
    const payload = buildCredentialsMarkdown({
      worldId: credentials.worldId,
      worldUrl: resolveWorldUrl(),
    })
    try {
      const copied = await copyToClipboard(payload)
      if (!copied) {
        setCredentialsError('clipboard_unavailable')
        return
      }
      setCopiedCredentials(true)
    } catch {
      setCredentialsError('clipboard_unavailable')
    }
  }

  const requestShutdown = async () => {
    if (!world.admin?.requestAgonesShutdown || shutdownPending || shutdownRequested) return
    setShutdownPending(true)
    setShutdownError(null)
    try {
      await world.admin.requestAgonesShutdown()
      setShutdownRequested(true)
    } catch (err) {
      setShutdownError(err?.code || 'request_failed')
    } finally {
      setShutdownPending(false)
    }
  }

  return (
    <Pane hidden={hidden}>
      <div
        className='world'
        css={css`
          background: ${theme.bgSection};
          border: 1px solid ${theme.borderLight};
          border-radius: ${theme.radius};
          display: flex;
          flex-direction: column;
          min-height: 12rem;
          .world-head {
            height: 3.125rem;
            padding: 0 1rem;
            border-bottom: 1px solid ${theme.borderLight};
            display: flex;
            align-items: center;
          }
          .world-title {
            font-weight: 500;
            font-size: 1rem;
            line-height: 1;
          }
          .world-content {
            flex: 1;
            padding: 0.5rem 0;
            overflow-y: auto;
          }
          .world-credentials {
            margin: 0.75rem 1rem 0.5rem;
            padding: 0.625rem 0.75rem;
            border-radius: 0.5rem;
            border: 1px solid ${theme.borderLight};
            background: rgba(255, 255, 255, 0.02);
            display: flex;
            flex-direction: column;
            gap: 0.375rem;
          }
          .world-credentials-title {
            font-size: 0.8125rem;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.72);
          }
          .world-credentials-note {
            font-size: 0.78125rem;
            color: rgba(255, 255, 255, 0.5);
          }
          .world-credentials-note.error {
            color: rgba(255, 122, 122, 0.95);
          }
          .world-credentials-row {
            min-height: 2rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .world-credentials-label {
            width: 4.75rem;
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.46);
          }
          .world-credentials-value {
            flex: 1;
            min-width: 0;
            font-size: 0.8125rem;
            text-align: right;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: rgba(255, 255, 255, 0.9);
          }
        `}
      >
        <div className='world-head'>
          <div className='world-title'>World</div>
        </div>
        <div className='world-content noscrollbar'>
          <FieldText
            label='Title'
            hint='Change the title of this world. Shown in the browser tab and when sharing links'
            placeholder='World'
            value={title}
            onChange={value => world.settings.set('title', value, true)}
          />
          <FieldText
            label='Description'
            hint='Change the description of this world. Shown in previews when sharing links to this world'
            value={desc}
            onChange={value => world.settings.set('desc', value, true)}
          />
          <FieldFile
            label='Image'
            hint='Change the image of the world. This is shown when loading into or sharing links to this world.'
            kind='image'
            value={image}
            onChange={value => world.settings.set('image', value, true)}
            world={world}
          />
          <FieldFile
            label='Default Avatar'
            hint='Change the default avatar everyone spawns into the world with'
            kind='avatar'
            value={avatar}
            onChange={value => world.settings.set('avatar', value, true)}
            world={world}
          />
          {isAdmin && world.settings.hasAdminCode && (
            <FieldToggle
              label='Custom Avatars'
              hint='Allow visitors to drag and drop custom VRM avatars.'
              trueLabel='On'
              falseLabel='Off'
              value={customAvatars}
              onChange={value => world.settings.set('customAvatars', value, true)}
            />
          )}
          <FieldSwitch
            label='Voice Chat'
            hint='Set the base voice chat mode. Apps are able to modify this using custom rules.'
            options={voiceChatOptions}
            value={voice}
            onChange={voice => world.settings.set('voice', voice, true)}
          />
          <FieldNumber
            label='Player Limit'
            hint={
              hasPlayerLimitCap
                ? `Set a maximum number of players that can be in the world at one time (1 to ${worldPlayerLimitCap} for this world).`
                : 'Set a maximum number of players that can be in the world at one time. Zero means unlimited.'
            }
            min={hasPlayerLimitCap ? 1 : 0}
            max={hasPlayerLimitCap ? worldPlayerLimitCap : Infinity}
            value={playerLimit}
            onChange={value => world.settings.set('playerLimit', value, true)}
          />
          <FieldToggle
            label='Ambient Occlusion'
            hint={`Improves visuals by approximating darkened corners etc. When enabled, users also have an option to disable this on their device for performance.`}
            trueLabel='On'
            falseLabel='Off'
            value={ao}
            onChange={value => world.settings.set('ao', value, true)}
          />
          {isAdmin && world.settings.hasAdminCode && (
            <FieldToggle
              label='Free Build'
              hint='Allow everyone to build (and destroy) things in the world.'
              trueLabel='On'
              falseLabel='Off'
              value={rank >= Ranks.BUILDER}
              onChange={value => world.settings.set('rank', value ? Ranks.BUILDER : Ranks.VISITOR, true)}
            />
          )}
          {isAdmin && (
            <>
              {shutdownError && <div className='world-credentials-note error'>{formatShutdownError(shutdownError)}</div>}
              {world.admin?.requestAgonesShutdown && (
                <FieldToggle
                  label='Shutdown'
                  hint='Manually save the world and request Agones shutdown for this runtime.'
                  trueLabel={shutdownPending ? 'Shutting down...' : 'Requested'}
                  falseLabel='Request'
                  value={shutdownPending || shutdownRequested}
                  disabled={shutdownPending || shutdownRequested}
                  onChange={() => {
                    void requestShutdown()
                  }}
                />
              )}
              {credentialsError && (
                <div className='world-credentials-note error'>{formatCredentialError(credentialsError)}</div>
              )}
              {!runtimeCredentials && credentialsLoading && (
                <div className='world-credentials-note'>Loading runtime credentials...</div>
              )}
              <FieldToggle
                label='Copy Setup Prompt'
                hint='Copy a Markdown setup guide for the SDK repo and browser-based world auth.'
                trueLabel='Copied'
                falseLabel={credentialsLoading ? 'Loading...' : 'Copy'}
                value={copiedCredentials}
                onChange={() => {
                  if (credentialsLoading) return
                  void copyCredentials()
                }}
              />
            </>
          )}
        </div>
      </div>
    </Pane>
  )
}
