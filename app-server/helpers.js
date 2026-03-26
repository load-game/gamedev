import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { isEqual } from 'lodash-es'
import { parse as acornParse } from 'acorn'
import { uuid } from './utils.js'
import { parseBlueprintId } from './blueprintUtils.js'
import { isValidScriptPath } from '../src/core/blueprintValidation.js'

export const BLUEPRINT_FIELDS = [
  'model',
  'image',
  'props',
  'preload',
  'public',
  'locked',
  'frozen',
  'unique',
  'scene',
  'disabled',
  'keep',
  'author',
  'url',
  'desc',
  'scope',
]

export const SCRIPT_EXTENSIONS = new Set(['.js', '.ts'])
export const SCRIPT_DIR_SKIP = new Set(['.git', 'node_modules'])
export const SHARED_DIR_NAME = 'shared'
export const SHARED_IMPORT_PREFIX = '@shared/'
export const SHARED_IMPORT_ALIAS = 'shared/'
export const CHANGEFEED_PAGE_LIMIT = 500
export const CHANGEFEED_MAX_PAGES = 20
export const MAX_SYNC_CONFLICT_SNAPSHOTS = 25
export const MAX_SYNC_CONFLICT_ARTIFACTS = 100
export const BLUEPRINT_IDENTITY_INDEX_VERSION = 1

export const OWNERSHIP_LOCAL = 'local'
export const OWNERSHIP_REMOTE = 'runtime'
export const OWNERSHIP_SHARED = 'shared'

export const BLUEPRINT_SCRIPT_FIELDS = ['script', 'scriptEntry', 'scriptFiles', 'scriptFormat', 'scriptRef']
export const BLUEPRINT_METADATA_FIELDS = ['name', ...BLUEPRINT_FIELDS.filter(field => field !== 'props')]
export const ENTITY_TRANSFORM_FIELDS = ['blueprint', 'position', 'quaternion', 'scale', 'pinned']

export const DEFAULT_SYNC_POLICY = {
  blueprints: {
    script: OWNERSHIP_LOCAL,
    metadata: OWNERSHIP_SHARED,
    props: OWNERSHIP_SHARED,
  },
  entities: {
    transform: OWNERSHIP_SHARED,
    props: OWNERSHIP_SHARED,
    state: OWNERSHIP_REMOTE,
  },
  world: {
    settings: {
      '*': OWNERSHIP_SHARED,
    },
    spawn: {
      position: OWNERSHIP_SHARED,
      quaternion: OWNERSHIP_SHARED,
    },
  },
}

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function normalizeBaseUrl(url) {
  if (!url) return ''
  return url.replace(/\/+$/, '')
}

export function normalizeWorldAdminBaseUrl(url) {
  const base = normalizeBaseUrl(url)
  if (!base) return ''

  try {
    const parsed = new URL(base)
    parsed.search = ''
    parsed.hash = ''
    parsed.pathname = parsed.pathname.replace(/\/admin\/?$/, '') || '/'
    return normalizeBaseUrl(parsed.toString())
  } catch {
    return base.replace(/\/admin\/?$/, '')
  }
}

export function toWsUrl(httpUrl) {
  const url = normalizeBaseUrl(httpUrl)
  if (url.startsWith('ws://') || url.startsWith('wss://')) return url
  if (url.startsWith('https://')) return `wss://${url.slice('https://'.length)}`
  if (url.startsWith('http://')) return `ws://${url.slice('http://'.length)}`
  return `ws://${url}`
}

export function joinUrl(base, pathname) {
  const a = normalizeBaseUrl(base)
  const b = (pathname || '').replace(/^\/+/, '')
  return `${a}/${b}`
}

export async function normalizePacketData(data) {
  if (!data) return data
  if (data instanceof Uint8Array) return data
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    const buffer = await data.arrayBuffer()
    return new Uint8Array(buffer)
  }
  return data
}

export function extractAssetFilename(url) {
  if (typeof url !== 'string') return null
  if (!url.startsWith('asset://')) return null
  return url.slice('asset://'.length)
}

export function isHashedAssetFilename(filename) {
  const ext = path.extname(filename)
  if (!ext) return false
  const base = filename.slice(0, -ext.length)
  return /^[a-f0-9]{64}$/i.test(base)
}

export function sanitizeFileBaseName(name) {
  const trimmed = (name || '').toString().trim()
  const base = trimmed.replace(/[^a-zA-Z0-9._ -]+/g, '-').replace(/\s+/g, ' ').trim()
  if (!base) return 'file'
  return base
}

export function buildSuggestedAssetFilename(name, { fallbackBase = 'file', ext = '' } = {}) {
  const normalizedExt = typeof ext === 'string' ? ext : ''
  let base = sanitizeFileBaseName(name || fallbackBase)
  if (normalizedExt && base.toLowerCase().endsWith(normalizedExt.toLowerCase())) {
    base = base.slice(0, -normalizedExt.length)
  }
  base = sanitizeFileBaseName(base || fallbackBase)
  return normalizedExt ? `${base}${normalizedExt}` : base
}

export function sanitizeDirName(name) {
  const base = sanitizeFileBaseName(name)
  return base.replace(/[. ]+$/g, '').replace(/^[. ]+/g, '') || 'app'
}

export function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

export function sortObjectKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(item => sortObjectKeysDeep(item))
  }
  if (value && typeof value === 'object') {
    const out = {}
    const keys = Object.keys(value).sort()
    for (const key of keys) {
      out[key] = sortObjectKeysDeep(value[key])
    }
    return out
  }
  return value
}

export function stableStringify(value) {
  return JSON.stringify(sortObjectKeysDeep(value))
}

export function cloneJson(value) {
  if (value === undefined) return undefined
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeSyncString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export function normalizeOptionalSecret(value) {
  return normalizeSyncString(value)
}

export function resolveWorldAdminAuth({ adminCode, authToken } = {}) {
  const normalizedAuthToken = normalizeOptionalSecret(authToken)
  if (normalizedAuthToken) {
    return {
      kind: 'player_token',
      tokenBacked: true,
      authToken: normalizedAuthToken,
      adminCode: null,
    }
  }
  return {
    kind: 'admin_code',
    tokenBacked: false,
    authToken: null,
    adminCode: normalizeOptionalSecret(adminCode),
  }
}

export function buildWorldAdminHeaders({ adminCode, authToken } = {}, extra = {}) {
  const headers = { ...extra }
  const auth = resolveWorldAdminAuth({ adminCode, authToken })
  if (auth.authToken) {
    headers.authorization = `Bearer ${auth.authToken}`
  } else if (auth.adminCode) {
    headers['X-Admin-Code'] = auth.adminCode
  }
  return headers
}

export function normalizeProjectRelativePath(value) {
  if (typeof value !== 'string') return null
  const normalized = normalizeScriptRelPath(value).trim()
  if (!normalized) return null
  const clean = path.posix.normalize(normalized)
  if (!clean || clean === '.' || clean.startsWith('../') || clean === '..') return null
  if (clean.startsWith('/')) return null
  return clean
}

export function toProjectRelativePath(rootDir, filePath) {
  if (typeof rootDir !== 'string' || typeof filePath !== 'string') return null
  const rel = normalizeScriptRelPath(path.relative(rootDir, filePath))
  return normalizeProjectRelativePath(rel)
}

export function normalizeSyncCursor(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const normalized = normalizeSyncString(value)
  return normalized || null
}

export function normalizeOwnershipValue(value, fallback = OWNERSHIP_SHARED) {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === OWNERSHIP_LOCAL) return OWNERSHIP_LOCAL
  if (normalized === OWNERSHIP_REMOTE || normalized === 'remote') return OWNERSHIP_REMOTE
  if (normalized === OWNERSHIP_SHARED) return OWNERSHIP_SHARED
  return fallback
}

export function resolveThreeWayValue({ base, local, remote, ownership = OWNERSHIP_SHARED } = {}) {
  const normalizedOwnership = normalizeOwnershipValue(ownership)
  if (isEqual(local, remote)) {
    return { ok: true, value: cloneJson(local), resolution: 'equal' }
  }
  const localChanged = !isEqual(local, base)
  const remoteChanged = !isEqual(remote, base)
  if (!localChanged && !remoteChanged) {
    return { ok: true, value: cloneJson(base), resolution: 'unchanged' }
  }
  if (localChanged && !remoteChanged) {
    return { ok: true, value: cloneJson(local), resolution: 'local-only' }
  }
  if (!localChanged && remoteChanged) {
    return { ok: true, value: cloneJson(remote), resolution: 'remote-only' }
  }
  if (normalizedOwnership === OWNERSHIP_LOCAL) {
    return { ok: true, value: cloneJson(local), resolution: 'local-policy' }
  }
  if (normalizedOwnership === OWNERSHIP_REMOTE) {
    return { ok: true, value: cloneJson(remote), resolution: 'remote-policy' }
  }
  return { ok: false, resolution: 'conflict' }
}

export function reconcileObjectByKeys({
  base,
  local,
  remote,
  ownershipForKey = null,
  defaultOwnership = OWNERSHIP_SHARED,
  pathPrefix = '',
} = {}) {
  const baseObject = isPlainObject(base) ? base : {}
  const localObject = isPlainObject(local) ? local : {}
  const remoteObject = isPlainObject(remote) ? remote : {}
  const keys = new Set([...Object.keys(baseObject), ...Object.keys(localObject), ...Object.keys(remoteObject)])
  const merged = {}
  const conflicts = []
  const autoResolved = []

  for (const key of keys) {
    const baseValue = baseObject[key]
    const localValue = localObject[key]
    const remoteValue = remoteObject[key]
    const ownership = normalizeOwnershipValue(
      typeof ownershipForKey === 'function' ? ownershipForKey(key) : defaultOwnership,
      defaultOwnership
    )
    const result = resolveThreeWayValue({
      base: baseValue,
      local: localValue,
      remote: remoteValue,
      ownership,
    })
    const path = pathPrefix ? `${pathPrefix}.${key}` : key
    if (result.ok) {
      if (result.value !== undefined) {
        merged[key] = cloneJson(result.value)
      }
      if (result.resolution === 'local-policy' || result.resolution === 'remote-policy') {
        autoResolved.push({
          path,
          ownership,
          resolution: result.resolution,
          value: cloneJson(result.value),
        })
      }
      continue
    }
    conflicts.push({
      path,
      ownership,
      base: cloneJson(baseValue),
      local: cloneJson(localValue),
      remote: cloneJson(remoteValue),
    })
    if (localValue !== undefined) {
      merged[key] = cloneJson(localValue)
    } else if (remoteValue !== undefined) {
      merged[key] = cloneJson(remoteValue)
    }
  }

  return { merged, conflicts, autoResolved }
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

export function listSubdirs(dirPath) {
  if (!fs.existsSync(dirPath)) return []
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
}

export function normalizeAssetPath(value) {
  if (typeof value !== 'string') return value
  return value.replace(/\\/g, '/')
}

export function normalizeScriptRelPath(value) {
  if (typeof value !== 'string') return value
  return value.replace(/\\/g, '/')
}

export function isRelativeImport(specifier) {
  return typeof specifier === 'string' && (specifier.startsWith('./') || specifier.startsWith('../'))
}

export function normalizeRelativePath(referrerPath, importSpecifier) {
  if (typeof referrerPath !== 'string' || typeof importSpecifier !== 'string') return null
  if (importSpecifier.includes('\\')) return null
  const refSegments = normalizeScriptRelPath(referrerPath).split('/').filter(Boolean)
  refSegments.pop()
  const specSegments = importSpecifier.split('/')
  const nextSegments = [...refSegments]
  for (const segment of specSegments) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (nextSegments.length === 0) return null
      nextSegments.pop()
      continue
    }
    nextSegments.push(segment)
  }
  const normalized = nextSegments.join('/')
  return normalized || null
}

export function normalizeSharedSpecifier(specifier) {
  if (typeof specifier !== 'string') return null
  const normalized = normalizeScriptRelPath(specifier)
  if (normalized.startsWith(SHARED_IMPORT_PREFIX)) {
    return isValidScriptPath(normalized) ? normalized : null
  }
  if (normalized.startsWith(SHARED_IMPORT_ALIAS)) {
    const rest = normalized.slice(SHARED_IMPORT_ALIAS.length)
    if (!rest) return null
    const relPath = `${SHARED_IMPORT_PREFIX}${rest}`
    return isValidScriptPath(relPath) ? relPath : null
  }
  return null
}

export function getSharedDiskRelativePath(relPath) {
  if (typeof relPath !== 'string') return null
  const normalized = normalizeScriptRelPath(relPath)
  if (normalized.startsWith(SHARED_IMPORT_PREFIX)) {
    const rest = normalized.slice(SHARED_IMPORT_PREFIX.length)
    return rest || null
  }
  if (normalized.startsWith(SHARED_IMPORT_ALIAS)) {
    const rest = normalized.slice(SHARED_IMPORT_ALIAS.length)
    return rest || null
  }
  return null
}

export const IMPORT_EXPORT_SPECIFIER_REGEX =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*from\s*)?['"]([^'"]+)['"]/g
export const DYNAMIC_IMPORT_SPECIFIER_REGEX = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

export function extractImportSpecifiersFallback(sourceText) {
  const specifiers = new Set()
  IMPORT_EXPORT_SPECIFIER_REGEX.lastIndex = 0
  DYNAMIC_IMPORT_SPECIFIER_REGEX.lastIndex = 0
  let match = null
  while ((match = IMPORT_EXPORT_SPECIFIER_REGEX.exec(sourceText)) !== null) {
    if (match[1]) specifiers.add(match[1])
  }
  while ((match = DYNAMIC_IMPORT_SPECIFIER_REGEX.exec(sourceText)) !== null) {
    if (match[1]) specifiers.add(match[1])
  }
  return Array.from(specifiers)
}

export function extractImportSpecifiers(sourceText) {
  if (typeof sourceText !== 'string' || !sourceText.trim()) return []
  let ast = null
  try {
    ast = acornParse(sourceText, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowHashBang: true,
    })
  } catch {
    return extractImportSpecifiersFallback(sourceText)
  }

  const specifiers = []
  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration') {
      const specifier = node.source?.value
      if (typeof specifier === 'string') specifiers.push(specifier)
      continue
    }
    if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
      const specifier = node.source?.value
      if (typeof specifier === 'string') specifiers.push(specifier)
    }
  }
  return specifiers
}

export function isScriptFilename(name) {
  const ext = path.extname(name || '').toLowerCase()
  return SCRIPT_EXTENSIONS.has(ext)
}

export function normalizeScriptFormat(value) {
  if (value === 'module' || value === 'legacy-body') return value
  return null
}

export function getScriptKey(blueprint) {
  const script = typeof blueprint?.script === 'string' ? blueprint.script.trim() : ''
  return script || null
}

export function normalizeScopeValue(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export function getBlueprintScopeValue(blueprint) {
  if (!blueprint || typeof blueprint !== 'object') return null
  return normalizeScopeValue(blueprint.scope)
}

export function toCreatedAtMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const ts = Date.parse(value)
    if (Number.isFinite(ts)) return ts
  }
  return null
}

export function getBlueprintFileBase(blueprint) {
  if (!blueprint) return ''
  if (typeof blueprint.fileBase === 'string' && blueprint.fileBase) return blueprint.fileBase
  if (typeof blueprint.id === 'string' && blueprint.id) {
    const parsed = parseBlueprintId(blueprint.id)
    return parsed.fileBase || blueprint.id
  }
  return ''
}

export function compareBlueprintsForMain(a, b) {
  const aTime = toCreatedAtMs(a?.createdAt)
  const bTime = toCreatedAtMs(b?.createdAt)
  if (aTime !== null && bTime !== null && aTime !== bTime) {
    return aTime - bTime
  }
  if (aTime !== null && bTime === null) return -1
  if (aTime === null && bTime !== null) return 1
  const aBase = (getBlueprintFileBase(a) || '').toLowerCase()
  const bBase = (getBlueprintFileBase(b) || '').toLowerCase()
  if (aBase < bBase) return -1
  if (aBase > bBase) return 1
  return 0
}

export function buildScriptGroupIndex(blueprints) {
  const groups = new Map()
  if (!blueprints) return groups
  const items = Array.isArray(blueprints) ? blueprints : Array.from(blueprints.values ? blueprints.values() : [])
  for (const blueprint of items) {
    const key = getScriptKey(blueprint)
    if (!key) continue
    let group = groups.get(key)
    if (!group) {
      group = { script: key, items: [], main: null }
      groups.set(key, group)
    }
    group.items.push(blueprint)
  }
  for (const group of groups.values()) {
    group.items.sort(compareBlueprintsForMain)
    group.main = group.items[0] || null
  }
  return groups
}

export function resolveUniqueFileBase(appPath, desiredBase, blueprintId, existingPath = null) {
  const base = sanitizeFileBaseName(desiredBase || blueprintId || 'blueprint')
  for (let idx = 0; idx < 10000; idx += 1) {
    const suffix = idx === 0 ? '' : `_${idx}`
    const candidate = `${base}${suffix}`
    const candidatePath = path.join(appPath, `${candidate}.json`)
    if (existingPath && path.resolve(candidatePath) === path.resolve(existingPath)) {
      return candidate
    }
    if (!fs.existsSync(candidatePath)) return candidate
    const existing = readJson(candidatePath)
    const existingId = typeof existing?.id === 'string' ? existing.id.trim() : ''
    if (existingId && existingId === blueprintId) {
      return candidate
    }
  }
  return `${base}_${uuid()}`
}

export function getExportedName(node) {
  if (!node) return null
  if (node.type === 'Identifier') return node.name
  if (node.type === 'Literal') return String(node.value)
  return null
}

export function entryHasDefaultExport(sourceText) {
  if (typeof sourceText !== 'string' || !sourceText.trim()) return false
  let ast
  try {
    ast = acornParse(sourceText, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowHashBang: true,
    })
  } catch {
    return /\bexport\s+default\b/.test(sourceText) || /\bexport\s*\{[^}]*\bdefault\b[^}]*\}/.test(sourceText)
  }
  for (const node of ast.body) {
    if (node.type === 'ExportDefaultDeclaration') return true
    if (node.type === 'ExportNamedDeclaration' && Array.isArray(node.specifiers)) {
      for (const spec of node.specifiers) {
        if (spec.type !== 'ExportSpecifier') continue
        const exported = getExportedName(spec.exported)
        if (exported === 'default') return true
      }
    }
  }
  return false
}

export function hasScriptFiles(blueprint) {
  return blueprint?.scriptFiles && typeof blueprint.scriptFiles === 'object' && !Array.isArray(blueprint.scriptFiles)
}

export function listScriptFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return []
  const files = []
  const pending = [rootDir]
  while (pending.length) {
    const dir = pending.pop()
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SCRIPT_DIR_SKIP.has(entry.name)) continue
        pending.push(path.join(dir, entry.name))
        continue
      }
      if (!entry.isFile()) continue
      if (!isScriptFilename(entry.name)) continue
      const absPath = path.join(dir, entry.name)
      const relPath = normalizeScriptRelPath(path.relative(rootDir, absPath))
      files.push({ absPath, relPath })
    }
  }
  files.sort((a, b) => a.relPath.localeCompare(b.relPath))
  return files
}

export function collectSharedDependencies(appFiles, sharedDir) {
  const sharedRelPaths = new Set()
  const queue = []

  const enqueue = relPath => {
    if (!relPath) return
    if (!relPath.startsWith(SHARED_IMPORT_PREFIX)) return
    if (!isValidScriptPath(relPath)) return
    if (sharedRelPaths.has(relPath)) return
    sharedRelPaths.add(relPath)
    queue.push(relPath)
  }

  for (const file of appFiles) {
    let sourceText = ''
    try {
      sourceText = fs.readFileSync(file.absPath, 'utf8')
    } catch {
      continue
    }
    const specifiers = extractImportSpecifiers(sourceText)
    for (const specifier of specifiers) {
      const relPath = normalizeSharedSpecifier(specifier)
      if (relPath) enqueue(relPath)
    }
  }

  while (queue.length) {
    const relPath = queue.pop()
    const sharedRel = getSharedDiskRelativePath(relPath)
    if (!sharedRel) continue
    const absPath = path.join(sharedDir, sharedRel)
    if (!fs.existsSync(absPath)) continue
    if (!isScriptFilename(absPath)) continue
    let sourceText = ''
    try {
      sourceText = fs.readFileSync(absPath, 'utf8')
    } catch {
      continue
    }
    const specifiers = extractImportSpecifiers(sourceText)
    for (const specifier of specifiers) {
      const aliasRelPath = normalizeSharedSpecifier(specifier)
      if (aliasRelPath) {
        enqueue(aliasRelPath)
        continue
      }
      if (!isRelativeImport(specifier)) continue
      const resolved = normalizeRelativePath(relPath, specifier)
      if (!resolved) continue
      if (!resolved.startsWith(SHARED_IMPORT_PREFIX)) continue
      if (!isValidScriptPath(resolved)) continue
      enqueue(resolved)
    }
  }

  return sharedRelPaths
}

export function buildSharedFileEntries(sharedRelPaths, sharedDir) {
  if (!sharedRelPaths || !sharedDir) return []
  const files = []
  for (const relPath of sharedRelPaths) {
    const sharedRel = getSharedDiskRelativePath(relPath)
    if (!sharedRel) continue
    const absPath = path.join(sharedDir, sharedRel)
    if (!fs.existsSync(absPath)) continue
    if (!isScriptFilename(absPath)) continue
    files.push({ absPath, relPath })
  }
  files.sort((a, b) => a.relPath.localeCompare(b.relPath))
  return files
}

export function getExistingAssetUrl(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof value.url === 'string') {
    return value.url
  }
  return null
}

export function pickBlueprintFields(source) {
  const out = {}
  for (const key of BLUEPRINT_FIELDS) {
    if (source[key] !== undefined) out[key] = source[key]
  }
  return out
}

export function normalizeBlueprintForCompare(source) {
  if (!source || typeof source !== 'object') return null
  return {
    id: source.id,
    name: source.name,
    script: source.script,
    scriptEntry: source.scriptEntry,
    scriptFiles: source.scriptFiles,
    scriptFormat: source.scriptFormat,
    scriptRef: source.scriptRef,
    ...pickBlueprintFields(source),
  }
}

export function normalizeBlueprintForCompareWithoutScript(source) {
  const normalized = normalizeBlueprintForCompare(source)
  if (!normalized) return normalized
  delete normalized.script
  delete normalized.scriptEntry
  delete normalized.scriptFiles
  delete normalized.scriptFormat
  delete normalized.scriptRef
  return normalized
}

export function normalizeBlueprintScriptFields(source) {
  if (!source || typeof source !== 'object') return null
  return {
    script: source.script,
    scriptEntry: source.scriptEntry,
    scriptFiles: source.scriptFiles,
    scriptFormat: source.scriptFormat,
    scriptRef: source.scriptRef,
  }
}

export function normalizeEntityForCompare(source) {
  if (!source || typeof source !== 'object') return null
  const props =
    source.props && typeof source.props === 'object' && !Array.isArray(source.props) ? source.props : {}
  return {
    id: source.id,
    type: source.type || 'app',
    blueprint: source.blueprint,
    position: Array.isArray(source.position) ? source.position.slice(0, 3) : [0, 0, 0],
    quaternion: Array.isArray(source.quaternion) ? source.quaternion.slice(0, 4) : [0, 0, 0, 1],
    scale: Array.isArray(source.scale) ? source.scale.slice(0, 3) : [1, 1, 1],
    pinned: Boolean(source.pinned),
    props,
    state: source.state && typeof source.state === 'object' ? source.state : {},
  }
}

export function normalizeSettingsForCompare(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
  return source
}

export function normalizeSpawnForCompare(source) {
  return {
    position: Array.isArray(source?.position) ? source.position.slice(0, 3) : [0, 0, 0],
    quaternion: Array.isArray(source?.quaternion) ? source.quaternion.slice(0, 4) : [0, 0, 0, 1],
  }
}

export function hashSyncValue(value) {
  return sha256(Buffer.from(stableStringify(value), 'utf8'))
}

export function buildBlueprintIdentitySignature(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null
  const createdAt = normalizeSyncString(config.createdAt)
  if (createdAt) return `createdAt:${createdAt}`
  const copy = cloneJson(config)
  if (!copy || typeof copy !== 'object' || Array.isArray(copy)) return null
  delete copy.id
  delete copy.uid
  return `hash:${hashSyncValue(copy)}`
}

export function createEmptyBlueprintIdentityIndex() {
  return {
    formatVersion: BLUEPRINT_IDENTITY_INDEX_VERSION,
    blueprints: {
      byId: {},
      byUid: {},
      byPath: {},
      bySignature: {},
    },
    updatedAt: null,
  }
}

export function classifySyncDiff({ baselineHash, localHash, remoteHash }) {
  const hasBaseline = baselineHash !== null && baselineHash !== undefined
  if (!hasBaseline) {
    if (localHash == null && remoteHash == null) return 'unchanged'
    if (localHash == null) return 'remote-only'
    if (remoteHash == null) return 'local-only'
    if (localHash === remoteHash) return 'unchanged'
    return 'concurrent'
  }
  const localChanged = localHash !== baselineHash
  const remoteChanged = remoteHash !== baselineHash
  if (!localChanged && !remoteChanged) return 'unchanged'
  if (localChanged && !remoteChanged) return 'local-only'
  if (!localChanged && remoteChanged) return 'remote-only'
  if (localHash === remoteHash) return 'unchanged'
  return 'concurrent'
}

export function formatNameList(items, limit = 6) {
  if (!Array.isArray(items) || items.length === 0) return ''
  if (items.length <= limit) return items.join(', ')
  const shown = items.slice(0, limit).join(', ')
  return `${shown} (+${items.length - limit} more)`
}
