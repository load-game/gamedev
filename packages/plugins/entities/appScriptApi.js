const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i

function splitAssetRef(value) {
  const queryIndex = value.indexOf('?')
  const hashIndex = value.indexOf('#')
  let suffixIndex = -1
  if (queryIndex >= 0 && hashIndex >= 0) {
    suffixIndex = Math.min(queryIndex, hashIndex)
  } else {
    suffixIndex = queryIndex >= 0 ? queryIndex : hashIndex
  }
  if (suffixIndex < 0) return { path: value, suffix: '' }
  return {
    path: value.slice(0, suffixIndex),
    suffix: value.slice(suffixIndex),
  }
}

function normalizeAppAssetPath(value) {
  if (typeof value !== 'string') return null
  let path = value.trim().replace(/\\/g, '/')
  while (path.startsWith('./')) path = path.slice(2)
  if (!path || path.startsWith('../') || path.includes('/../')) return null
  return path
}

function getAssetMap(entity) {
  const assetMap = entity?.blueprint?.assetMap
  if (!assetMap || typeof assetMap !== 'object' || Array.isArray(assetMap)) return null
  return assetMap
}

function lookupMappedAsset(entity, path) {
  const assetMap = getAssetMap(entity)
  if (!assetMap) return null
  const candidates = [path]
  const normalized = normalizeAppAssetPath(path)
  if (normalized && normalized !== path) candidates.push(normalized)
  if (normalized) candidates.push(`./${normalized}`)
  for (const candidate of candidates) {
    const value = assetMap[candidate]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function resolveScriptAssetUrl(entity, url) {
  if (!url) return ''
  const value = url.trim()
  if (!value) return ''
  if (value.startsWith('//')) return `https:${value}`
  if (value.startsWith('/') || value.startsWith('blob:') || value.startsWith('data:')) return value
  if (URL_SCHEME_RE.test(value) && !value.startsWith('asset://')) return value
  if (value.startsWith('asset://')) {
    return entity.world.resolveURL ? entity.world.resolveURL(value) : value
  }
  return ''
}

export const appEntityScriptApi = {
  app: {
    asset: {
      call(entity, relativePath) {
        if (typeof relativePath !== 'string') return ''
        const raw = relativePath.trim()
        if (!raw) return ''
        const directUrl = resolveScriptAssetUrl(entity, raw)
        if (directUrl) return directUrl

        const { path, suffix } = splitAssetRef(raw)
        const normalized = normalizeAppAssetPath(path)
        if (!normalized) return ''
        const mapped = lookupMappedAsset(entity, normalized)
        if (!mapped) return ''
        const resolved = resolveScriptAssetUrl(entity, mapped)
        return resolved ? `${resolved}${suffix}` : ''
      },
      meta: {
        summary: 'Resolve a bundled app asset from blueprint assetMap metadata.',
        docs: '/docs/scripting/app/App.md#assetrelativepath-string',
      },
    },
  },
}
