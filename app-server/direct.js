import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { WorldManifest } from './WorldManifest.js'
import { deriveBlueprintId, parseBlueprintId, isBlueprintDenylist } from './blueprintUtils.js'
import { scaffoldBaseProject, scaffoldBuiltins } from './scaffold.js'
import { BUILTIN_BLUEPRINT_IDS, SCENE_TEMPLATE } from './templates/builtins.js'
import { WorldAdminClient } from './WorldAdminClient.js'
import {
  BLUEPRINT_FIELDS,
  SCRIPT_EXTENSIONS,
  SCRIPT_DIR_SKIP,
  SHARED_DIR_NAME,
  SHARED_IMPORT_PREFIX,
  SHARED_IMPORT_ALIAS,
  CHANGEFEED_PAGE_LIMIT,
  CHANGEFEED_MAX_PAGES,
  MAX_SYNC_CONFLICT_SNAPSHOTS,
  MAX_SYNC_CONFLICT_ARTIFACTS,
  BLUEPRINT_IDENTITY_INDEX_VERSION,
  OWNERSHIP_LOCAL,
  OWNERSHIP_REMOTE,
  OWNERSHIP_SHARED,
  BLUEPRINT_SCRIPT_FIELDS,
  BLUEPRINT_METADATA_FIELDS,
  ENTITY_TRANSFORM_FIELDS,
  DEFAULT_SYNC_POLICY,
  sha256,
  sleep,
  normalizeWorldAdminBaseUrl,
  toWsUrl,
  joinUrl,
  normalizePacketData,
  extractAssetFilename,
  isHashedAssetFilename,
  sanitizeFileBaseName,
  buildSuggestedAssetFilename,
  sanitizeDirName,
  readJson,
  sortObjectKeysDeep,
  stableStringify,
  cloneJson,
  isPlainObject,
  normalizeSyncString,
  normalizeProjectRelativePath,
  toProjectRelativePath,
  normalizeSyncCursor,
  normalizeOwnershipValue,
  resolveThreeWayValue,
  reconcileObjectByKeys,
  ensureDir,
  listSubdirs,
  normalizeAssetPath,
  normalizeScriptRelPath,
  isRelativeImport,
  normalizeRelativePath,
  normalizeSharedSpecifier,
  getSharedDiskRelativePath,
  extractImportSpecifiers,
  isScriptFilename,
  normalizeScriptFormat,
  getScriptKey,
  normalizeScopeValue,
  getBlueprintScopeValue,
  toCreatedAtMs,
  getBlueprintFileBase,
  compareBlueprintsForMain,
  buildScriptGroupIndex,
  resolveUniqueFileBase,
  getExportedName,
  entryHasDefaultExport,
  hasScriptFiles,
  listScriptFiles,
  collectSharedDependencies,
  buildSharedFileEntries,
  getExistingAssetUrl,
  pickBlueprintFields,
  normalizeBlueprintForCompare,
  normalizeBlueprintForCompareWithoutScript,
  normalizeBlueprintScriptFields,
  normalizeEntityForCompare,
  normalizeSettingsForCompare,
  normalizeSpawnForCompare,
  hashSyncValue,
  buildBlueprintIdentitySignature,
  createEmptyBlueprintIdentityIndex,
  classifySyncDiff,
  formatNameList,
} from './helpers.js'
import { isValidScriptPath } from '../src/core/blueprintValidation.js'
import { isEqual } from 'lodash-es'
import { uuid } from './utils.js'
import { ensureProjectAuth } from './cliAuth.js'

export class DirectAppServer {
  constructor({ worldUrl, adminCode, authToken, worldId = null, rootDir = process.cwd() }) {
    this.rootDir = rootDir
    this.worldUrl = normalizeWorldAdminBaseUrl(worldUrl)
    this.adminCode = adminCode || null
    this.authToken = authToken || null
    this.worldId = worldId || process.env.WORLD_ID || null
    this.lobbyDir = path.join(this.rootDir, '.lobby')
    this.appsDir = path.join(this.rootDir, 'apps')
    this.assetsDir = path.join(this.rootDir, 'assets')
    this.sharedDir = path.join(this.rootDir, SHARED_DIR_NAME)
    this.worldFile = path.join(this.rootDir, 'world.json')
    this.syncStateFile = path.join(this.lobbyDir, 'sync-state.json')
    this.blueprintIdentityFile = path.join(this.lobbyDir, 'blueprint-index.json')
    this.conflictsDir = path.join(this.lobbyDir, 'conflicts')
    this.syncPolicyFile = path.join(this.lobbyDir, 'sync-policy.json')
    this.manifest = new WorldManifest(this.worldFile)

    this.client = new WorldAdminClient({
      worldUrl: this.worldUrl,
      adminCode: this.adminCode,
      authToken: this.authToken,
    })
    this.deployTimers = new Map()
    this.deployQueues = new Map()
    this.removeTimers = new Map()
    this.pendingWrites = new Set()
    this.watchers = new Map()
    this.reconnecting = false
    this.pendingManifestWrite = null
    this.localBlueprintPathIndex = new Map()

    this.assetsUrl = null
    this.snapshot = null
    this.syncState = this._readSyncState()
    this.blueprintIdentityIndex = this._readBlueprintIdentityIndex()
    this.syncPolicy = this._readSyncPolicy()
    this.deferSyncStateWrites = false
    this.loggedTarget = false
    this.loggedChangefeedWarning = false
    this.scriptFormatWarnings = new Set()
  }

  async connect({ refreshSyncState = true, syncCursorFromChangefeed = true } = {}) {
    await this.client.connect()
    const snapshot = await this.client.getSnapshot()
    this.assetsUrl = snapshot.assetsUrl
    this._validateWorldId(snapshot.worldId)
    this._initSnapshot(snapshot, { refreshSyncState })
    if (syncCursorFromChangefeed) {
      try {
        await this._syncCursorFromChangefeed()
      } catch (err) {
        const message = err?.message || ''
        if (!message.startsWith('changes_failed:')) {
          throw err
        }
        if (!this.loggedChangefeedWarning) {
          console.warn(`⚠️  Changefeed unavailable (${message}); continuing without cursor sync.`)
          this.loggedChangefeedWarning = true
        }
      }
    }
    return snapshot
  }

  _validateWorldId(remoteWorldId) {
    const localWorldId = process.env.WORLD_ID
    if (!localWorldId) {
      throw new Error('Missing WORLD_ID in .env. Set WORLD_ID to match the target world.')
    }
    if (!remoteWorldId) {
      throw new Error('Missing worldId from /admin/snapshot.')
    }
    if (remoteWorldId !== localWorldId) {
      throw new Error(`WORLD_ID mismatch: local=${localWorldId} remote=${remoteWorldId}`)
    }
  }

  _initSnapshot(snapshot, { refreshSyncState = true } = {}) {
    const settings = snapshot.settings && typeof snapshot.settings === 'object' ? { ...snapshot.settings } : {}
    const spawn = {
      position: Array.isArray(snapshot.spawn?.position) ? snapshot.spawn.position.slice(0, 3) : [0, 0, 0],
      quaternion: Array.isArray(snapshot.spawn?.quaternion) ? snapshot.spawn.quaternion.slice(0, 4) : [0, 0, 0, 1],
    }
    const blueprints = new Map()
    const blueprintList = Array.isArray(snapshot.blueprints) ? snapshot.blueprints : []
    for (const blueprint of blueprintList) {
      if (blueprint?.id) blueprints.set(blueprint.id, blueprint)
    }
    const entities = new Map()
    const entityList = Array.isArray(snapshot.entities) ? snapshot.entities : []
    for (const entity of entityList) {
      if (entity?.id) entities.set(entity.id, entity)
    }
    this.snapshot = {
      worldId: snapshot.worldId || null,
      assetsUrl: snapshot.assetsUrl || null,
      settings,
      spawn,
      blueprints,
      entities,
    }
    if (refreshSyncState) {
      this._refreshSyncState()
    }
  }

  _readSyncState() {
    const state = readJson(this.syncStateFile)
    if (!state || typeof state !== 'object') return null
    return state
  }

  _normalizeBlueprintIdentityRecord(record, { key, keyType } = {}) {
    if (!record || typeof record !== 'object') return null
    const id = keyType === 'id' ? normalizeSyncString(key) : normalizeSyncString(record.id)
    if (!id) return null
    const uid = keyType === 'uid' ? normalizeSyncString(key) : normalizeSyncString(record.uid) || null
    const projectionPath = normalizeProjectRelativePath(keyType === 'path' ? key : record.path)
    const signature = keyType === 'signature' ? normalizeSyncString(key) : normalizeSyncString(record.signature) || null
    return {
      id,
      uid,
      path: projectionPath,
      signature,
    }
  }

  _readBlueprintIdentityIndex() {
    const fallback = createEmptyBlueprintIdentityIndex()
    const state = readJson(this.blueprintIdentityFile)
    if (!state || typeof state !== 'object') return fallback
    const blueprints = state.blueprints && typeof state.blueprints === 'object' ? state.blueprints : {}
    const normalizeTable = (table, keyType) => {
      const output = {}
      if (!table || typeof table !== 'object') return output
      for (const [key, value] of Object.entries(table)) {
        const normalized = this._normalizeBlueprintIdentityRecord(value, { key, keyType })
        if (!normalized) continue
        if (keyType === 'id') {
          output[normalized.id] = normalized
          continue
        }
        if (keyType === 'uid' && normalized.uid) {
          output[normalized.uid] = normalized
          continue
        }
        if (keyType === 'path' && normalized.path) {
          output[normalized.path] = normalized
          continue
        }
        if (keyType === 'signature' && normalized.signature) {
          output[normalized.signature] = normalized
        }
      }
      return output
    }
    return {
      formatVersion: typeof state.formatVersion === 'number' ? state.formatVersion : BLUEPRINT_IDENTITY_INDEX_VERSION,
      blueprints: {
        byId: normalizeTable(blueprints.byId, 'id'),
        byUid: normalizeTable(blueprints.byUid, 'uid'),
        byPath: normalizeTable(blueprints.byPath, 'path'),
        bySignature: normalizeTable(blueprints.bySignature, 'signature'),
      },
      updatedAt: normalizeSyncString(state.updatedAt),
    }
  }

  _writeBlueprintIdentityIndex(next) {
    if (!next || typeof next !== 'object') return
    const previous =
      this.blueprintIdentityIndex && typeof this.blueprintIdentityIndex === 'object'
        ? this.blueprintIdentityIndex
        : createEmptyBlueprintIdentityIndex()
    if (isEqual(previous.blueprints, next.blueprints)) return
    const output = {
      formatVersion: BLUEPRINT_IDENTITY_INDEX_VERSION,
      blueprints: next.blueprints,
      updatedAt: new Date().toISOString(),
    }
    this.blueprintIdentityIndex = output
    this._writeFileAtomic(this.blueprintIdentityFile, JSON.stringify(output, null, 2) + '\n')
  }

  _buildBlueprintIdentityLookup() {
    const lookup = {
      byId: new Map(),
      byUid: new Map(),
      byPath: new Map(),
      bySignature: new Map(),
    }

    const indexState =
      this.blueprintIdentityIndex?.blueprints && typeof this.blueprintIdentityIndex.blueprints === 'object'
        ? this.blueprintIdentityIndex.blueprints
        : {}

    const byIdTable = indexState.byId && typeof indexState.byId === 'object' ? indexState.byId : {}
    for (const [idKey, rawRecord] of Object.entries(byIdTable)) {
      const record = this._normalizeBlueprintIdentityRecord(rawRecord, { key: idKey, keyType: 'id' })
      if (!record) continue
      lookup.byId.set(record.id, record)
      if (record.uid) lookup.byUid.set(record.uid, record.id)
    }

    const byUidTable = indexState.byUid && typeof indexState.byUid === 'object' ? indexState.byUid : {}
    for (const [uidKey, rawRecord] of Object.entries(byUidTable)) {
      const record = this._normalizeBlueprintIdentityRecord(rawRecord, { key: uidKey, keyType: 'uid' })
      if (!record || !record.uid) continue
      const currentId = normalizeSyncString(record.id)
      if (!currentId) continue
      lookup.byUid.set(record.uid, currentId)
      const existing = lookup.byId.get(currentId) || { id: currentId, uid: null, path: null, signature: null }
      lookup.byId.set(currentId, {
        ...existing,
        uid: record.uid || existing.uid,
      })
    }

    const byPathTable = indexState.byPath && typeof indexState.byPath === 'object' ? indexState.byPath : {}
    for (const [pathKey, rawRecord] of Object.entries(byPathTable)) {
      const record = this._normalizeBlueprintIdentityRecord(rawRecord, { key: pathKey, keyType: 'path' })
      if (!record || !record.path) continue
      lookup.byPath.set(record.path, record)
    }

    const bySignatureTable =
      indexState.bySignature && typeof indexState.bySignature === 'object' ? indexState.bySignature : {}
    for (const [signatureKey, rawRecord] of Object.entries(bySignatureTable)) {
      const record = this._normalizeBlueprintIdentityRecord(rawRecord, {
        key: signatureKey,
        keyType: 'signature',
      })
      if (!record || !record.signature) continue
      lookup.bySignature.set(record.signature, record)
    }

    const baselineEntries = this.syncState?.objects?.blueprints
    if (baselineEntries && typeof baselineEntries === 'object') {
      for (const entry of Object.values(baselineEntries)) {
        const id = normalizeSyncString(entry?.id)
        if (!id) continue
        const uid = normalizeSyncString(entry?.uid)
        const existing = lookup.byId.get(id) || { id, uid: null, path: null, signature: null }
        lookup.byId.set(id, { ...existing, uid: uid || existing.uid })
        if (uid) lookup.byUid.set(uid, id)
      }
    }

    for (const blueprint of this.snapshot?.blueprints?.values() || []) {
      const id = normalizeSyncString(blueprint?.id)
      if (!id) continue
      const uid = normalizeSyncString(blueprint?.uid)
      const existing = lookup.byId.get(id) || { id, uid: null, path: null, signature: null }
      lookup.byId.set(id, { ...existing, uid: uid || existing.uid })
      if (uid) lookup.byUid.set(uid, id)
    }

    return lookup
  }

  _resolveIndexedBlueprintId({ appName, fileBase, cfg, configPath, identityLookup }) {
    const explicit = normalizeSyncString(cfg?.id)
    if (explicit) return explicit

    const uid = normalizeSyncString(cfg?.uid)
    if (uid) {
      const mapped = identityLookup?.byUid?.get(uid)
      if (mapped) return mapped
    }

    const relativeConfigPath = toProjectRelativePath(this.rootDir, configPath)
    if (relativeConfigPath) {
      const record = identityLookup?.byPath?.get(relativeConfigPath)
      const mapped = normalizeSyncString(record?.id)
      if (mapped) return mapped
    }

    const signature = buildBlueprintIdentitySignature(cfg)
    if (signature) {
      const record = identityLookup?.bySignature?.get(signature)
      const mapped = normalizeSyncString(record?.id)
      if (mapped) return mapped
    }

    return deriveBlueprintId(appName, fileBase)
  }

  _resolveIndexedBlueprintUid({ id, cfg, identityLookup }) {
    const explicit = normalizeSyncString(cfg?.uid)
    if (explicit) return explicit
    const record = identityLookup?.byId?.get(id)
    return normalizeSyncString(record?.uid) || null
  }

  _syncBlueprintIdentityIndex(localIndex) {
    const previous =
      this.blueprintIdentityIndex && typeof this.blueprintIdentityIndex === 'object'
        ? this.blueprintIdentityIndex
        : createEmptyBlueprintIdentityIndex()
    const previousBlueprints = previous.blueprints && typeof previous.blueprints === 'object' ? previous.blueprints : {}
    const nextById = {
      ...(previousBlueprints.byId && typeof previousBlueprints.byId === 'object' ? previousBlueprints.byId : {}),
    }
    const nextByUid = {
      ...(previousBlueprints.byUid && typeof previousBlueprints.byUid === 'object' ? previousBlueprints.byUid : {}),
    }
    const nextBySignature = {
      ...(previousBlueprints.bySignature && typeof previousBlueprints.bySignature === 'object'
        ? previousBlueprints.bySignature
        : {}),
    }
    const nextByPath = {}

    for (const info of localIndex?.values() || []) {
      const id = normalizeSyncString(info?.id)
      if (!id) continue
      const uid = normalizeSyncString(info?.uid)
      const projectionPath =
        normalizeProjectRelativePath(info?.relativeConfigPath) || toProjectRelativePath(this.rootDir, info?.configPath)
      const signature = normalizeSyncString(info?.identitySignature)
      const record = {
        id,
        uid: uid || null,
        path: projectionPath || null,
        signature: signature || null,
      }
      nextById[id] = record
      if (uid) nextByUid[uid] = record
      if (signature) nextBySignature[signature] = record
      if (projectionPath) nextByPath[projectionPath] = record
    }

    const next = {
      formatVersion: BLUEPRINT_IDENTITY_INDEX_VERSION,
      blueprints: {
        byId: nextById,
        byUid: nextByUid,
        byPath: nextByPath,
        bySignature: nextBySignature,
      },
      updatedAt: previous.updatedAt,
    }
    this._writeBlueprintIdentityIndex(next)
  }

  _getBlueprintIdentityRecord(id) {
    const normalizedId = normalizeSyncString(id)
    if (!normalizedId) return null
    const table =
      this.blueprintIdentityIndex?.blueprints?.byId && typeof this.blueprintIdentityIndex.blueprints.byId === 'object'
        ? this.blueprintIdentityIndex.blueprints.byId
        : null
    if (!table) return null
    const raw = table[normalizedId]
    if (!raw || typeof raw !== 'object') return null
    return this._normalizeBlueprintIdentityRecord(raw, { key: normalizedId, keyType: 'id' })
  }

  _getAppNameFromProjectionPath(projectionPath) {
    const normalized = normalizeProjectRelativePath(projectionPath)
    if (!normalized) return null
    const segments = normalized.split('/')
    if (segments.length < 3) return null
    if (segments[0] !== 'apps') return null
    return normalizeSyncString(segments[1]) || null
  }

  _resolveBlueprintProjection(id, { localIndex } = {}) {
    const normalizedId = normalizeSyncString(id)
    if (!normalizedId) return { info: null, configPath: null, appName: null }
    const index = localIndex || this._indexLocalBlueprints()
    const info = index.get(normalizedId) || null
    if (info?.configPath) {
      return {
        info,
        configPath: info.configPath,
        appName: info.appName,
      }
    }

    const identityRecord = this._getBlueprintIdentityRecord(normalizedId)
    const identityPath = normalizeProjectRelativePath(identityRecord?.path)
    if (identityPath) {
      return {
        info: null,
        configPath: path.join(this.rootDir, identityPath),
        appName: this._getAppNameFromProjectionPath(identityPath),
      }
    }

    const parsed = parseBlueprintId(normalizedId)
    return {
      info: null,
      configPath: path.join(this.appsDir, parsed.appName, `${parsed.fileBase}.json`),
      appName: parsed.appName,
    }
  }

  _readSyncPolicy() {
    const defaults = cloneJson(DEFAULT_SYNC_POLICY)
    const configured = readJson(this.syncPolicyFile)
    if (!configured || typeof configured !== 'object') return defaults

    if (configured.blueprints && typeof configured.blueprints === 'object') {
      defaults.blueprints.script = normalizeOwnershipValue(configured.blueprints.script, defaults.blueprints.script)
      defaults.blueprints.metadata = normalizeOwnershipValue(
        configured.blueprints.metadata,
        defaults.blueprints.metadata
      )
      defaults.blueprints.props = normalizeOwnershipValue(configured.blueprints.props, defaults.blueprints.props)
    }

    if (configured.entities && typeof configured.entities === 'object') {
      defaults.entities.transform = normalizeOwnershipValue(configured.entities.transform, defaults.entities.transform)
      defaults.entities.props = normalizeOwnershipValue(configured.entities.props, defaults.entities.props)
      defaults.entities.state = normalizeOwnershipValue(configured.entities.state, defaults.entities.state)
    }

    if (configured.world && typeof configured.world === 'object') {
      if (configured.world.settings && typeof configured.world.settings === 'object') {
        const nextSettings = { ...defaults.world.settings }
        for (const [key, value] of Object.entries(configured.world.settings)) {
          nextSettings[key] = normalizeOwnershipValue(value, nextSettings[key] || OWNERSHIP_SHARED)
        }
        defaults.world.settings = nextSettings
      }
      if (configured.world.spawn && typeof configured.world.spawn === 'object') {
        defaults.world.spawn.position = normalizeOwnershipValue(
          configured.world.spawn.position,
          defaults.world.spawn.position
        )
        defaults.world.spawn.quaternion = normalizeOwnershipValue(
          configured.world.spawn.quaternion,
          defaults.world.spawn.quaternion
        )
      }
    }

    return defaults
  }

  _getBlueprintScriptOwnership() {
    return normalizeOwnershipValue(this.syncPolicy?.blueprints?.script, OWNERSHIP_LOCAL)
  }

  _getBlueprintMetadataOwnership() {
    return normalizeOwnershipValue(this.syncPolicy?.blueprints?.metadata, OWNERSHIP_SHARED)
  }

  _getBlueprintPropsOwnership() {
    return normalizeOwnershipValue(this.syncPolicy?.blueprints?.props, OWNERSHIP_SHARED)
  }

  _getEntityTransformOwnership() {
    return normalizeOwnershipValue(this.syncPolicy?.entities?.transform, OWNERSHIP_SHARED)
  }

  _getEntityPropsOwnership() {
    return normalizeOwnershipValue(this.syncPolicy?.entities?.props, OWNERSHIP_SHARED)
  }

  _getEntityStateOwnership(fallback = OWNERSHIP_REMOTE) {
    return normalizeOwnershipValue(this.syncPolicy?.entities?.state, fallback)
  }

  _getWorldSettingsOwnership(key) {
    const settingsPolicy = this.syncPolicy?.world?.settings
    if (!settingsPolicy || typeof settingsPolicy !== 'object') {
      return OWNERSHIP_SHARED
    }
    const specific = normalizeOwnershipValue(settingsPolicy[key], null)
    if (specific) return specific
    return normalizeOwnershipValue(settingsPolicy['*'], OWNERSHIP_SHARED)
  }

  _getSpawnOwnership(key) {
    const spawnPolicy = this.syncPolicy?.world?.spawn
    if (!spawnPolicy || typeof spawnPolicy !== 'object') {
      return OWNERSHIP_SHARED
    }
    return normalizeOwnershipValue(spawnPolicy[key], OWNERSHIP_SHARED)
  }

  _extractSyncRevision(item) {
    if (!item || typeof item !== 'object') return null
    if (typeof item.version === 'number' && Number.isFinite(item.version)) {
      return item.version
    }
    return normalizeSyncString(item.updatedAt) || null
  }

  _normalizeSyncObjectForHash(kind, item) {
    if (!item || typeof item !== 'object') return null
    if (kind === 'blueprints') return normalizeBlueprintForCompare(item)
    if (kind === 'entities') return normalizeEntityForCompare(item)
    return item
  }

  _hashSyncObject(kind, item) {
    const normalized = this._normalizeSyncObjectForHash(kind, item)
    if (!normalized) return null
    return hashSyncValue(normalized)
  }

  _buildSyncObjectIndex(kind, items, previousIndex = {}, nowIso) {
    const entries = {}
    const previous = previousIndex && typeof previousIndex === 'object' ? previousIndex : {}
    const values = Array.isArray(items) ? items : Array.from(items?.values ? items.values() : [])
    for (const item of values) {
      if (!item || typeof item !== 'object') continue
      const id = normalizeSyncString(item.id)
      const uid = normalizeSyncString(item.uid)
      const key = uid || id
      if (!key) continue
      const normalizedValue = this._normalizeSyncObjectForHash(kind, item)
      const hash = normalizedValue ? hashSyncValue(normalizedValue) : null
      if (!hash) continue
      const lastSyncedRevision = this._extractSyncRevision(item)
      const existing = previous[key]
      const unchanged = existing?.hash === hash && isEqual(existing?.lastSyncedRevision, lastSyncedRevision)
      entries[key] = {
        id: id || null,
        uid: uid || null,
        hash,
        value: cloneJson(normalizedValue),
        lastSyncedRevision,
        lastSyncedAt: unchanged && normalizeSyncString(existing?.lastSyncedAt) ? existing.lastSyncedAt : nowIso,
        lastOpId: normalizeSyncString(item.lastOpId) || null,
      }
    }
    return entries
  }

  _buildSyncWorldEntry(kind, value, previousEntry = {}, nowIso) {
    const hashInput = kind === 'settings' ? normalizeSettingsForCompare(value) : normalizeSpawnForCompare(value)
    const hash = hashSyncValue(hashInput)
    const existing = previousEntry && typeof previousEntry === 'object' ? previousEntry : {}
    const unchanged = existing?.hash === hash
    return {
      hash,
      value: cloneJson(hashInput),
      lastSyncedAt: unchanged && normalizeSyncString(existing?.lastSyncedAt) ? existing.lastSyncedAt : nowIso,
    }
  }

  _buildSyncStateSnapshot({ cursor } = {}) {
    if (!this.snapshot?.worldId) return null

    const previous = this.syncState && typeof this.syncState === 'object' ? this.syncState : {}
    const previousWorldId = normalizeSyncString(previous.worldId)
    const worldChanged = !!previousWorldId && previousWorldId !== this.snapshot.worldId
    const previousObjects =
      !worldChanged && previous.objects && typeof previous.objects === 'object' ? previous.objects : {}
    const previousWorldState =
      !worldChanged && previous.world && typeof previous.world === 'object' ? previous.world : {}
    const nowIso = new Date().toISOString()

    const nextCursor =
      cursor !== undefined ? normalizeSyncCursor(cursor) : worldChanged ? null : normalizeSyncCursor(previous.cursor)

    return {
      formatVersion: 1,
      worldId: this.snapshot.worldId,
      cursor: nextCursor,
      world: {
        settings: this._buildSyncWorldEntry('settings', this.snapshot.settings, previousWorldState.settings, nowIso),
        spawn: this._buildSyncWorldEntry('spawn', this.snapshot.spawn, previousWorldState.spawn, nowIso),
      },
      objects: {
        blueprints: this._buildSyncObjectIndex(
          'blueprints',
          this.snapshot.blueprints,
          previousObjects.blueprints,
          nowIso
        ),
        entities: this._buildSyncObjectIndex('entities', this.snapshot.entities, previousObjects.entities, nowIso),
      },
      lastConflictSnapshots:
        !worldChanged && Array.isArray(previous.lastConflictSnapshots) ? previous.lastConflictSnapshots : [],
      updatedAt: normalizeSyncString(previous.updatedAt) || nowIso,
    }
  }

  _writeSyncState(next) {
    if (!next || typeof next !== 'object') return
    if (this.deferSyncStateWrites) return
    const previous = this.syncState && typeof this.syncState === 'object' ? this.syncState : {}
    if (isEqual(previous, next)) return
    const nowIso = new Date().toISOString()
    const output = {
      ...next,
      updatedAt: nowIso,
    }
    this.syncState = output
    this._writeFileAtomic(this.syncStateFile, JSON.stringify(output, null, 2) + '\n')
  }

  async _withDeferredSyncStateWrites(fn) {
    const previous = this.deferSyncStateWrites
    this.deferSyncStateWrites = true
    try {
      return await fn()
    } finally {
      this.deferSyncStateWrites = previous
    }
  }

  _refreshSyncState() {
    const next = this._buildSyncStateSnapshot()
    this._writeSyncState(next)
  }

  _setSyncCursor(cursor) {
    const next = this._buildSyncStateSnapshot({ cursor })
    this._writeSyncState(next)
  }

  async _syncCursorFromChangefeed({ limit = CHANGEFEED_PAGE_LIMIT, maxPages = CHANGEFEED_MAX_PAGES } = {}) {
    if (!this.snapshot?.worldId) return
    const initialCursor = normalizeSyncCursor(this.syncState?.cursor)
    let cursor = initialCursor
    let pages = 0
    let sawOperation = false

    while (pages < maxPages) {
      const response = await this.client.getChanges({ cursor, limit })
      const operations = Array.isArray(response?.operations) ? response.operations : []
      if (operations.length > 0) sawOperation = true
      const nextCursor = normalizeSyncCursor(response?.cursor)
      if (nextCursor !== null) {
        if (nextCursor === cursor && operations.length >= limit) {
          break
        }
        cursor = nextCursor
      }
      pages += 1
      if (operations.length < limit) break
    }

    if (!sawOperation && initialCursor == null && cursor === 0) {
      this._setSyncCursor(null)
      return
    }

    this._setSyncCursor(cursor)
  }

  _isBidirectionalSyncEnabled() {
    const flag = normalizeSyncString(process.env.BIDIRECTIONAL_SYNC)
    if (!flag) return true
    return flag.toLowerCase() !== 'false'
  }

  _isStrictSyncConflictsEnabled() {
    const flag = normalizeSyncString(process.env.SYNC_STRICT_CONFLICTS)
    if (!flag) return true
    return flag.toLowerCase() !== 'false'
  }

  async _getRuntimeHeadCursor({ fallback = null } = {}) {
    try {
      const response = await this.client.getChanges()
      const cursor = normalizeSyncCursor(response?.headCursor ?? response?.cursor)
      return cursor ?? normalizeSyncCursor(fallback)
    } catch (err) {
      const message = err?.message || ''
      if (!message.startsWith('changes_failed:')) {
        throw err
      }
      if (!this.loggedChangefeedWarning) {
        console.warn(`⚠️  Changefeed unavailable (${message}); continuing without cursor sync.`)
        this.loggedChangefeedWarning = true
      }
      return normalizeSyncCursor(fallback)
    }
  }

  _syncEntriesById(entries) {
    const byId = new Map()
    if (!entries || typeof entries !== 'object') return byId
    for (const entry of Object.values(entries)) {
      const id = normalizeSyncString(entry?.id)
      if (!id) continue
      byId.set(id, entry)
    }
    return byId
  }

  _buildManifestEntityIndex(manifest) {
    const byId = new Map()
    const entities = Array.isArray(manifest?.entities) ? manifest.entities : []
    for (const entity of entities) {
      if (!entity?.id) continue
      const normalized = normalizeEntityForCompare({ ...entity, type: 'app' })
      if (!normalized) continue
      byId.set(normalized.id, normalized)
    }
    return byId
  }

  _buildManifestEntityStateOwnershipIndex(manifest) {
    const byId = new Map()
    const entities = Array.isArray(manifest?.entities) ? manifest.entities : []
    const defaultOwnership = this._getEntityStateOwnership(OWNERSHIP_REMOTE)
    for (const entity of entities) {
      const id = normalizeSyncString(entity?.id)
      if (!id) continue
      const direct = normalizeOwnershipValue(entity?.stateOwnership, null)
      const nested = normalizeOwnershipValue(entity?.sync?.state, null)
      byId.set(id, direct || nested || defaultOwnership)
    }
    return byId
  }

  _normalizeBaselineSyncValue(kind, entry) {
    if (!entry || typeof entry !== 'object') return null
    if (!Object.prototype.hasOwnProperty.call(entry, 'value')) return null
    if (kind === 'settings') return normalizeSettingsForCompare(entry.value)
    if (kind === 'spawn') return normalizeSpawnForCompare(entry.value)
    return this._normalizeSyncObjectForHash(kind, entry.value)
  }

  _createSyncConflict({
    kind,
    id,
    uid,
    baselineHash,
    localHash,
    remoteHash,
    base,
    local,
    remote,
    merged = null,
    unresolvedFields = [],
    autoResolvedFields = [],
  } = {}) {
    return {
      kind: normalizeSyncString(kind) || 'unknown',
      id: normalizeSyncString(id) || null,
      uid: normalizeSyncString(uid) || normalizeSyncString(remote?.uid) || normalizeSyncString(base?.uid) || null,
      baselineHash: normalizeSyncString(baselineHash),
      localHash: normalizeSyncString(localHash),
      remoteHash: normalizeSyncString(remoteHash),
      base: cloneJson(base),
      local: cloneJson(local),
      remote: cloneJson(remote),
      merged: cloneJson(merged),
      unresolvedFields: Array.isArray(unresolvedFields) ? unresolvedFields : [],
      autoResolvedFields: Array.isArray(autoResolvedFields) ? autoResolvedFields : [],
    }
  }

  _resolveBlueprintField({ field, base, local, remote, ownership, merged, unresolvedFields, autoResolvedFields }) {
    const result = resolveThreeWayValue({
      base: base?.[field],
      local: local?.[field],
      remote: remote?.[field],
      ownership,
    })
    if (!result.ok) {
      unresolvedFields.push({
        path: field,
        ownership,
        base: cloneJson(base?.[field]),
        local: cloneJson(local?.[field]),
        remote: cloneJson(remote?.[field]),
      })
      if (local?.[field] !== undefined) merged[field] = cloneJson(local[field])
      else if (remote?.[field] !== undefined) merged[field] = cloneJson(remote[field])
      return
    }
    if (result.value !== undefined) {
      merged[field] = cloneJson(result.value)
    }
    if (result.resolution === 'local-policy' || result.resolution === 'remote-policy') {
      autoResolvedFields.push({
        path: field,
        ownership,
        resolution: result.resolution,
        value: cloneJson(result.value),
      })
    }
  }

  _reconcileBlueprint({ id, uid, baselineHash, localHash, remoteHash, base, local, remote }) {
    const baseValue = normalizeBlueprintForCompare(base)
    const localValue = normalizeBlueprintForCompare(local)
    const remoteValue = normalizeBlueprintForCompare(remote)
    const scriptOwnership = this._getBlueprintScriptOwnership()
    const metadataOwnership = this._getBlueprintMetadataOwnership()
    const propsOwnership = this._getBlueprintPropsOwnership()

    if (!localValue || !remoteValue) {
      const result = resolveThreeWayValue({
        base: baseValue,
        local: localValue,
        remote: remoteValue,
        ownership: OWNERSHIP_SHARED,
      })
      if (result.ok) {
        return { merged: result.value }
      }
      return {
        conflict: this._createSyncConflict({
          kind: 'blueprint',
          id,
          uid,
          baselineHash,
          localHash,
          remoteHash,
          base: baseValue,
          local: localValue,
          remote: remoteValue,
          unresolvedFields: [
            {
              path: '$object',
              ownership: OWNERSHIP_SHARED,
              base: cloneJson(baseValue),
              local: cloneJson(localValue),
              remote: cloneJson(remoteValue),
            },
          ],
        }),
      }
    }

    const merged = { id }
    const unresolvedFields = []
    const autoResolvedFields = []

    for (const field of BLUEPRINT_SCRIPT_FIELDS) {
      this._resolveBlueprintField({
        field,
        base: baseValue,
        local: localValue,
        remote: remoteValue,
        ownership: scriptOwnership,
        merged,
        unresolvedFields,
        autoResolvedFields,
      })
    }

    for (const field of BLUEPRINT_METADATA_FIELDS) {
      this._resolveBlueprintField({
        field,
        base: baseValue,
        local: localValue,
        remote: remoteValue,
        ownership: metadataOwnership,
        merged,
        unresolvedFields,
        autoResolvedFields,
      })
    }

    const propsResult = reconcileObjectByKeys({
      base: baseValue?.props,
      local: localValue?.props,
      remote: remoteValue?.props,
      defaultOwnership: propsOwnership,
      pathPrefix: 'props',
    })
    if (
      Object.keys(propsResult.merged).length > 0 ||
      localValue.props !== undefined ||
      remoteValue.props !== undefined
    ) {
      merged.props = propsResult.merged
    }
    unresolvedFields.push(...propsResult.conflicts)
    autoResolvedFields.push(...propsResult.autoResolved)

    if (unresolvedFields.length > 0) {
      return {
        conflict: this._createSyncConflict({
          kind: 'blueprint',
          id,
          uid,
          baselineHash,
          localHash,
          remoteHash,
          base: baseValue,
          local: localValue,
          remote: remoteValue,
          merged,
          unresolvedFields,
          autoResolvedFields,
        }),
      }
    }

    return { merged }
  }

  _resolveEntityField({ field, base, local, remote, ownership, merged, unresolvedFields, autoResolvedFields }) {
    const result = resolveThreeWayValue({
      base: base?.[field],
      local: local?.[field],
      remote: remote?.[field],
      ownership,
    })
    if (!result.ok) {
      unresolvedFields.push({
        path: field,
        ownership,
        base: cloneJson(base?.[field]),
        local: cloneJson(local?.[field]),
        remote: cloneJson(remote?.[field]),
      })
      merged[field] = cloneJson(local?.[field])
      return
    }
    merged[field] = cloneJson(result.value)
    if (result.resolution === 'local-policy' || result.resolution === 'remote-policy') {
      autoResolvedFields.push({
        path: field,
        ownership,
        resolution: result.resolution,
        value: cloneJson(result.value),
      })
    }
  }

  _reconcileEntity({
    id,
    uid,
    baselineHash,
    localHash,
    remoteHash,
    base,
    local,
    remote,
    stateOwnership = OWNERSHIP_REMOTE,
  }) {
    const baseValue = normalizeEntityForCompare(base)
    const localValue = normalizeEntityForCompare(local)
    const remoteValue = normalizeEntityForCompare(remote)
    const transformOwnership = this._getEntityTransformOwnership()
    const propsOwnership = this._getEntityPropsOwnership()
    const normalizedStateOwnership = normalizeOwnershipValue(stateOwnership, this._getEntityStateOwnership())

    if (!localValue || !remoteValue) {
      const result = resolveThreeWayValue({
        base: baseValue,
        local: localValue,
        remote: remoteValue,
        ownership: OWNERSHIP_SHARED,
      })
      if (result.ok) {
        return { merged: result.value }
      }
      return {
        conflict: this._createSyncConflict({
          kind: 'entity',
          id,
          uid,
          baselineHash,
          localHash,
          remoteHash,
          base: baseValue,
          local: localValue,
          remote: remoteValue,
          unresolvedFields: [
            {
              path: '$object',
              ownership: OWNERSHIP_SHARED,
              base: cloneJson(baseValue),
              local: cloneJson(localValue),
              remote: cloneJson(remoteValue),
            },
          ],
        }),
      }
    }

    const merged = {
      id,
      type: remoteValue.type || localValue.type || 'app',
    }
    const unresolvedFields = []
    const autoResolvedFields = []

    for (const field of ENTITY_TRANSFORM_FIELDS) {
      this._resolveEntityField({
        field,
        base: baseValue,
        local: localValue,
        remote: remoteValue,
        ownership: transformOwnership,
        merged,
        unresolvedFields,
        autoResolvedFields,
      })
    }

    const propsResult = reconcileObjectByKeys({
      base: baseValue?.props,
      local: localValue?.props,
      remote: remoteValue?.props,
      defaultOwnership: propsOwnership,
      pathPrefix: 'props',
    })
    merged.props = propsResult.merged
    unresolvedFields.push(...propsResult.conflicts)
    autoResolvedFields.push(...propsResult.autoResolved)

    this._resolveEntityField({
      field: 'state',
      base: baseValue,
      local: localValue,
      remote: remoteValue,
      ownership: normalizedStateOwnership,
      merged,
      unresolvedFields,
      autoResolvedFields,
    })

    if (unresolvedFields.length > 0) {
      return {
        conflict: this._createSyncConflict({
          kind: 'entity',
          id,
          uid,
          baselineHash,
          localHash,
          remoteHash,
          base: baseValue,
          local: localValue,
          remote: remoteValue,
          merged,
          unresolvedFields,
          autoResolvedFields,
        }),
      }
    }

    return { merged }
  }

  _reconcileSettings({ baselineHash, localHash, remoteHash, base, local, remote }) {
    const baseValue = normalizeSettingsForCompare(base)
    const localValue = normalizeSettingsForCompare(local)
    const remoteValue = normalizeSettingsForCompare(remote)
    const result = reconcileObjectByKeys({
      base: baseValue,
      local: localValue,
      remote: remoteValue,
      ownershipForKey: key => this._getWorldSettingsOwnership(key),
      defaultOwnership: OWNERSHIP_SHARED,
      pathPrefix: 'settings',
    })

    if (result.conflicts.length > 0) {
      return {
        conflict: this._createSyncConflict({
          kind: 'settings',
          id: '$world.settings',
          baselineHash,
          localHash,
          remoteHash,
          base: baseValue,
          local: localValue,
          remote: remoteValue,
          merged: result.merged,
          unresolvedFields: result.conflicts,
          autoResolvedFields: result.autoResolved,
        }),
      }
    }
    return { merged: result.merged }
  }

  _reconcileSpawn({ baselineHash, localHash, remoteHash, base, local, remote }) {
    const baseValue = normalizeSpawnForCompare(base)
    const localValue = normalizeSpawnForCompare(local)
    const remoteValue = normalizeSpawnForCompare(remote)
    const merged = {}
    const unresolvedFields = []
    const autoResolvedFields = []

    for (const field of ['position', 'quaternion']) {
      const ownership = this._getSpawnOwnership(field)
      const result = resolveThreeWayValue({
        base: baseValue?.[field],
        local: localValue?.[field],
        remote: remoteValue?.[field],
        ownership,
      })
      if (!result.ok) {
        unresolvedFields.push({
          path: `spawn.${field}`,
          ownership,
          base: cloneJson(baseValue?.[field]),
          local: cloneJson(localValue?.[field]),
          remote: cloneJson(remoteValue?.[field]),
        })
        merged[field] = cloneJson(localValue?.[field])
        continue
      }
      merged[field] = cloneJson(result.value)
      if (result.resolution === 'local-policy' || result.resolution === 'remote-policy') {
        autoResolvedFields.push({
          path: `spawn.${field}`,
          ownership,
          resolution: result.resolution,
          value: cloneJson(result.value),
        })
      }
    }

    if (unresolvedFields.length > 0) {
      return {
        conflict: this._createSyncConflict({
          kind: 'spawn',
          id: '$world.spawn',
          baselineHash,
          localHash,
          remoteHash,
          base: baseValue,
          local: localValue,
          remote: remoteValue,
          merged,
          unresolvedFields,
          autoResolvedFields,
        }),
      }
    }

    return { merged }
  }

  _normalizeSnapshotCollection(items) {
    if (Array.isArray(items)) return items
    if (items instanceof Map) return Array.from(items.values())
    if (items && typeof items.values === 'function') return Array.from(items.values())
    return []
  }

  _normalizeSnapshotForExport(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {}
    const settings = source.settings && typeof source.settings === 'object' ? { ...source.settings } : {}
    const spawn = normalizeSpawnForCompare(source.spawn)
    const blueprints = this._normalizeSnapshotCollection(source.blueprints)
    const entities = this._normalizeSnapshotCollection(source.entities)
    return {
      ...source,
      settings,
      spawn,
      blueprints,
      entities,
    }
  }

  async _buildLocalBlueprintPayloadIndex(localIndex = this._indexLocalBlueprints()) {
    const localBlueprints = new Map()
    const byApp = new Map()
    for (const info of localIndex.values()) {
      if (!byApp.has(info.appName)) byApp.set(info.appName, [])
      byApp.get(info.appName).push(info)
    }
    for (const [appName, infos] of byApp.entries()) {
      const scriptInfo = await this._safeUploadScriptForApp(appName, infos[0]?.scriptPath, {
        upload: false,
        allowMissing: true,
      })
      if (scriptInfo?.mode === 'module') {
        this._assignScriptRootsForApp(appName, infos, scriptInfo, localIndex)
      }
      for (const info of infos) {
        const desired = await this._prepareBlueprintPayload(info, scriptInfo, { uploadAssets: false })
        localBlueprints.set(info.id, desired)
      }
    }
    return localBlueprints
  }

  _computeStartupHandshakePlan({ manifest, localBlueprints }) {
    const plan = {
      mergedManifest: JSON.parse(JSON.stringify(manifest)),
      blueprints: {
        localOnlyUpserts: [],
        localOnlyRemovals: [],
        remoteOnlyUpserts: [],
        remoteOnlyRemovals: [],
        mergedActions: [],
      },
      manifest: {
        localOnly: false,
        remoteOnly: false,
        settingsMode: 'unchanged',
        spawnMode: 'unchanged',
        localOnlyEntities: [],
        remoteOnlyEntities: [],
      },
      conflicts: [],
    }

    const baselineBlueprints = this._syncEntriesById(this.syncState?.objects?.blueprints)
    const baselineEntities = this._syncEntriesById(this.syncState?.objects?.entities)
    const remoteBlueprints = this.snapshot?.blueprints || new Map()
    const localEntities = this._buildManifestEntityIndex(manifest)
    const localEntityStateOwnership = this._buildManifestEntityStateOwnershipIndex(manifest)
    const remoteEntities = new Map()
    for (const entity of this.snapshot?.entities?.values() || []) {
      if (entity?.type !== 'app' || !entity?.id) continue
      const normalized = normalizeEntityForCompare(entity)
      if (!normalized) continue
      remoteEntities.set(normalized.id, normalized)
    }

    const localSettings = normalizeSettingsForCompare(manifest?.settings)
    const remoteSettings = normalizeSettingsForCompare(this.snapshot?.settings)
    const baselineSettingsEntry = this.syncState?.world?.settings
    const baselineSettingsHash = normalizeSyncString(baselineSettingsEntry?.hash)
    const baselineSettingsValue = this._normalizeBaselineSyncValue('settings', baselineSettingsEntry)
    const localSettingsHash = hashSyncValue(localSettings)
    const remoteSettingsHash = hashSyncValue(remoteSettings)
    const settingsMode = classifySyncDiff({
      baselineHash: baselineSettingsHash,
      localHash: localSettingsHash,
      remoteHash: remoteSettingsHash,
    })
    plan.manifest.settingsMode = settingsMode
    if (settingsMode === 'remote-only') {
      plan.manifest.remoteOnly = true
      plan.mergedManifest.settings = remoteSettings
    } else if (settingsMode === 'local-only') {
      plan.manifest.localOnly = true
    } else if (settingsMode === 'concurrent') {
      const reconciliation = this._reconcileSettings({
        baselineHash: baselineSettingsHash,
        localHash: localSettingsHash,
        remoteHash: remoteSettingsHash,
        base: baselineSettingsValue,
        local: localSettings,
        remote: remoteSettings,
      })
      if (reconciliation.conflict) {
        plan.conflicts.push(reconciliation.conflict)
      } else {
        const merged = normalizeSettingsForCompare(reconciliation.merged)
        plan.mergedManifest.settings = merged
        if (!isEqual(merged, localSettings)) {
          plan.manifest.remoteOnly = true
        }
        if (!isEqual(merged, remoteSettings)) {
          plan.manifest.localOnly = true
        }
      }
    }

    const localSpawn = normalizeSpawnForCompare(manifest?.spawn)
    const remoteSpawn = normalizeSpawnForCompare(this.snapshot?.spawn)
    const baselineSpawnEntry = this.syncState?.world?.spawn
    const baselineSpawnHash = normalizeSyncString(baselineSpawnEntry?.hash)
    const baselineSpawnValue = this._normalizeBaselineSyncValue('spawn', baselineSpawnEntry)
    const localSpawnHash = hashSyncValue(localSpawn)
    const remoteSpawnHash = hashSyncValue(remoteSpawn)
    const spawnMode = classifySyncDiff({
      baselineHash: baselineSpawnHash,
      localHash: localSpawnHash,
      remoteHash: remoteSpawnHash,
    })
    plan.manifest.spawnMode = spawnMode
    if (spawnMode === 'remote-only') {
      plan.manifest.remoteOnly = true
      plan.mergedManifest.spawn = remoteSpawn
    } else if (spawnMode === 'local-only') {
      plan.manifest.localOnly = true
    } else if (spawnMode === 'concurrent') {
      const reconciliation = this._reconcileSpawn({
        baselineHash: baselineSpawnHash,
        localHash: localSpawnHash,
        remoteHash: remoteSpawnHash,
        base: baselineSpawnValue,
        local: localSpawn,
        remote: remoteSpawn,
      })
      if (reconciliation.conflict) {
        plan.conflicts.push(reconciliation.conflict)
      } else {
        const merged = normalizeSpawnForCompare(reconciliation.merged)
        plan.mergedManifest.spawn = merged
        if (!isEqual(merged, localSpawn)) {
          plan.manifest.remoteOnly = true
        }
        if (!isEqual(merged, remoteSpawn)) {
          plan.manifest.localOnly = true
        }
      }
    }

    const mergedEntities = new Map(localEntities)
    const entityIds = new Set([...baselineEntities.keys(), ...localEntities.keys(), ...remoteEntities.keys()])
    for (const id of entityIds) {
      const baselineEntry = baselineEntities.get(id)
      const baselineHash = normalizeSyncString(baselineEntry?.hash)
      const baselineValue = this._normalizeBaselineSyncValue('entities', baselineEntry)
      const localEntity = localEntities.get(id) || null
      const remoteEntity = remoteEntities.get(id) || null
      const localHash = localEntity ? hashSyncValue(localEntity) : null
      const remoteHash = remoteEntity ? hashSyncValue(remoteEntity) : null
      const mode = classifySyncDiff({ baselineHash, localHash, remoteHash })
      if (mode === 'remote-only') {
        plan.manifest.remoteOnly = true
        plan.manifest.remoteOnlyEntities.push(id)
        if (remoteEntity) mergedEntities.set(id, remoteEntity)
        else mergedEntities.delete(id)
        continue
      }
      if (mode === 'local-only') {
        plan.manifest.localOnly = true
        plan.manifest.localOnlyEntities.push(id)
        continue
      }
      if (mode === 'concurrent') {
        const reconciliation = this._reconcileEntity({
          id,
          uid: normalizeSyncString(remoteEntity?.uid) || normalizeSyncString(baselineEntry?.uid) || null,
          baselineHash,
          localHash,
          remoteHash,
          base: baselineValue,
          local: localEntity,
          remote: remoteEntity,
          stateOwnership: localEntityStateOwnership.get(id) || this._getEntityStateOwnership(),
        })
        if (reconciliation.conflict) {
          plan.conflicts.push(reconciliation.conflict)
          continue
        }
        const merged = reconciliation.merged
        if (merged) {
          mergedEntities.set(id, merged)
        } else {
          mergedEntities.delete(id)
        }
        if (!isEqual(merged, localEntity)) {
          plan.manifest.remoteOnly = true
          plan.manifest.remoteOnlyEntities.push(id)
        }
        if (!isEqual(merged, remoteEntity)) {
          plan.manifest.localOnly = true
          plan.manifest.localOnlyEntities.push(id)
        }
      }
    }
    plan.mergedManifest.entities = Array.from(mergedEntities.values())

    const blueprintIds = new Set([...baselineBlueprints.keys(), ...localBlueprints.keys(), ...remoteBlueprints.keys()])
    for (const id of blueprintIds) {
      const baselineEntry = baselineBlueprints.get(id)
      const baselineHash = normalizeSyncString(baselineEntry?.hash)
      const baselineValue = this._normalizeBaselineSyncValue('blueprints', baselineEntry)
      const localBlueprint = normalizeBlueprintForCompare(localBlueprints.get(id) || null)
      const remoteBlueprintRaw = remoteBlueprints.get(id) || null
      const remoteBlueprint = normalizeBlueprintForCompare(remoteBlueprintRaw)
      const localHash = localBlueprint ? hashSyncValue(localBlueprint) : null
      const remoteHash = remoteBlueprint ? hashSyncValue(remoteBlueprint) : null
      const mode = classifySyncDiff({ baselineHash, localHash, remoteHash })
      if (mode === 'remote-only') {
        if (remoteBlueprintRaw) plan.blueprints.remoteOnlyUpserts.push(id)
        else plan.blueprints.remoteOnlyRemovals.push(id)
        continue
      }
      if (mode === 'local-only') {
        if (localBlueprint) plan.blueprints.localOnlyUpserts.push(id)
        else plan.blueprints.localOnlyRemovals.push(id)
        continue
      }
      if (mode === 'concurrent') {
        const reconciliation = this._reconcileBlueprint({
          id,
          uid: normalizeSyncString(remoteBlueprintRaw?.uid) || normalizeSyncString(baselineEntry?.uid) || null,
          baselineHash,
          localHash,
          remoteHash,
          base: baselineValue,
          local: localBlueprint,
          remote: remoteBlueprint,
        })
        if (reconciliation.conflict) {
          plan.conflicts.push(reconciliation.conflict)
          continue
        }
        const merged = reconciliation.merged
        const localNeedsUpdate = !isEqual(merged, localBlueprint)
        const remoteNeedsUpdate = !isEqual(merged, remoteBlueprint)
        if (localNeedsUpdate || remoteNeedsUpdate) {
          plan.blueprints.mergedActions.push({
            id,
            merged,
            localNeedsUpdate,
            remoteNeedsUpdate,
          })
        }
      }
    }

    plan.manifest.localOnlyEntities = Array.from(new Set(plan.manifest.localOnlyEntities))
    plan.manifest.remoteOnlyEntities = Array.from(new Set(plan.manifest.remoteOnlyEntities))

    return plan
  }

  _removeLocalBlueprintFromDisk(id, { localIndex } = {}) {
    const index = localIndex || this._indexLocalBlueprints()
    const projection = this._resolveBlueprintProjection(id, { localIndex: index })
    const info = projection.info
    const parsed = parseBlueprintId(id)
    const appName = projection.appName || info?.appName || parsed.appName
    const configPath =
      projection.configPath || info?.configPath || path.join(this.appsDir, appName, `${parsed.fileBase || id}.json`)
    const existingConfig = readJson(configPath)
    const keep = info?.keep === true || existingConfig?.keep === true
    if (keep) return false
    if (fs.existsSync(configPath)) {
      this._deleteFileAtomic(configPath)
    }
    index.delete(id)
    if (configPath) {
      this.localBlueprintPathIndex.delete(configPath)
    }
    this._syncBlueprintIdentityIndex(index)
    this._maybeRemoveEmptyAppFolder(appName)
    return true
  }

  async _applyRemoteOnlyBlueprintChanges(plan, localIndex) {
    const scriptGroups = buildScriptGroupIndex(this.snapshot?.blueprints || new Map())
    for (const id of plan.blueprints.remoteOnlyUpserts) {
      const blueprint = this.snapshot?.blueprints?.get(id)
      if (!blueprint) continue
      const result = await this._writeBlueprintToDisk({
        blueprint,
        force: true,
        includeBuiltScripts: true,
        includeScriptSources: true,
        pruneScriptSources: true,
        localIndex,
        scriptGroups,
      })
      if (result?.appName) {
        this._watchAppDir(result.appName)
      }
    }
    for (const id of plan.blueprints.remoteOnlyRemovals) {
      this._removeLocalBlueprintFromDisk(id, { localIndex })
    }
  }

  async _pushLocalOnlyBlueprintChanges(plan, localIndex) {
    const byApp = new Map()
    for (const id of plan.blueprints.localOnlyUpserts) {
      const info = localIndex.get(id)
      if (!info) continue
      if (!byApp.has(info.appName)) byApp.set(info.appName, [])
      byApp.get(info.appName).push(info)
    }
    for (const [appName, infos] of byApp.entries()) {
      await this._deployBlueprintsForApp(appName, infos, localIndex)
    }
    if (plan.blueprints.localOnlyRemovals.length) {
      await this._removeBlueprintsAndEntities(plan.blueprints.localOnlyRemovals)
    }
  }

  async _applyMergedBlueprintChanges(plan, localIndex) {
    const actions = Array.isArray(plan?.blueprints?.mergedActions) ? plan.blueprints.mergedActions : []
    for (const action of actions) {
      const id = normalizeSyncString(action?.id)
      if (!id) continue
      const merged = action && Object.prototype.hasOwnProperty.call(action, 'merged') ? action.merged : null
      const localNeedsUpdate = action?.localNeedsUpdate === true
      const remoteNeedsUpdate = action?.remoteNeedsUpdate === true

      if (localNeedsUpdate) {
        if (merged) {
          const result = await this._writeBlueprintToDisk({
            blueprint: merged,
            force: true,
            includeBuiltScripts: false,
            includeScriptSources: false,
            pruneScriptSources: false,
            localIndex,
          })
          if (result?.appName) {
            this._watchAppDir(result.appName)
          }
        } else {
          this._removeLocalBlueprintFromDisk(id, { localIndex })
        }
      }

      if (!remoteNeedsUpdate) continue

      if (merged) {
        await this._deployBlueprintById(id)
      } else {
        await this._removeBlueprintsAndEntities([id])
      }
    }
  }

  _listSyncConflictArtifactPaths() {
    if (!fs.existsSync(this.conflictsDir)) return []
    const files = fs
      .readdirSync(this.conflictsDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => path.join(this.conflictsDir, entry.name))
    files.sort((a, b) => {
      const aId = path.basename(a)
      const bId = path.basename(b)
      return aId.localeCompare(bId)
    })
    return files
  }

  listSyncConflictArtifacts({ includeResolved = false } = {}) {
    const artifacts = []
    for (const artifactPath of this._listSyncConflictArtifactPaths()) {
      const artifact = readJson(artifactPath)
      if (!artifact || typeof artifact !== 'object') continue
      if (!includeResolved && normalizeSyncString(artifact.status) === 'resolved') continue
      artifacts.push({
        ...artifact,
        filePath: artifactPath,
      })
    }
    artifacts.sort((a, b) => {
      const aTs = Date.parse(a.createdAt || 0) || 0
      const bTs = Date.parse(b.createdAt || 0) || 0
      return bTs - aTs
    })
    return artifacts
  }

  getSyncConflictArtifact(conflictId) {
    const id = normalizeSyncString(conflictId)
    if (!id) return null
    const artifactPath = path.join(this.conflictsDir, `${id}.json`)
    const artifact = readJson(artifactPath)
    if (!artifact || typeof artifact !== 'object') return null
    return {
      ...artifact,
      filePath: artifactPath,
    }
  }

  _pruneSyncConflictArtifacts(maxArtifacts = MAX_SYNC_CONFLICT_ARTIFACTS) {
    const paths = this._listSyncConflictArtifactPaths()
    if (paths.length <= maxArtifacts) return
    const byAge = paths
      .map(filePath => {
        const data = readJson(filePath)
        const ts = Date.parse(data?.createdAt || data?.resolvedAt || 0) || 0
        return { filePath, ts }
      })
      .sort((a, b) => a.ts - b.ts)
    for (const item of byAge.slice(0, Math.max(0, byAge.length - maxArtifacts))) {
      try {
        this._deleteFileAtomic(item.filePath)
      } catch {}
    }
  }

  _writeSyncConflictArtifacts(conflicts, { cursor, reason = 'startup', at } = {}) {
    if (!Array.isArray(conflicts) || conflicts.length === 0) return []
    ensureDir(this.conflictsDir)
    const nowIso = normalizeSyncString(at) || new Date().toISOString()
    const summaries = []
    for (const conflict of conflicts) {
      const artifactId = uuid()
      const artifact = {
        formatVersion: 1,
        id: artifactId,
        status: 'open',
        createdAt: nowIso,
        resolvedAt: null,
        resolvedWith: null,
        worldId: normalizeSyncString(this.snapshot?.worldId) || normalizeSyncString(this.syncState?.worldId),
        reason,
        cursor: normalizeSyncCursor(cursor),
        kind: normalizeSyncString(conflict?.kind) || 'unknown',
        objectType: normalizeSyncString(conflict?.kind) || 'unknown',
        objectId: normalizeSyncString(conflict?.id) || null,
        objectUid: normalizeSyncString(conflict?.uid) || null,
        baselineHash: normalizeSyncString(conflict?.baselineHash),
        localHash: normalizeSyncString(conflict?.localHash),
        remoteHash: normalizeSyncString(conflict?.remoteHash),
        base: cloneJson(conflict?.base),
        local: cloneJson(conflict?.local),
        remote: cloneJson(conflict?.remote),
        merged: cloneJson(conflict?.merged),
        unresolvedFields: Array.isArray(conflict?.unresolvedFields) ? conflict.unresolvedFields : [],
        autoResolvedFields: Array.isArray(conflict?.autoResolvedFields) ? conflict.autoResolvedFields : [],
      }
      const artifactPath = path.join(this.conflictsDir, `${artifactId}.json`)
      this._writeFileAtomic(artifactPath, JSON.stringify(artifact, null, 2) + '\n')
      summaries.push({
        artifactId,
        kind: artifact.kind,
        id: artifact.objectId,
        uid: artifact.objectUid,
        baselineHash: artifact.baselineHash,
        localHash: artifact.localHash,
        remoteHash: artifact.remoteHash,
        unresolvedCount: artifact.unresolvedFields.length,
        autoResolvedCount: artifact.autoResolvedFields.length,
      })
    }
    this._pruneSyncConflictArtifacts()
    return summaries
  }

  _recordSyncConflicts(conflicts, { cursor, reason = 'startup' } = {}) {
    if (!Array.isArray(conflicts) || !conflicts.length) return []
    const previous = this.syncState && typeof this.syncState === 'object' ? this.syncState : {}
    const nowIso = new Date().toISOString()
    const summaries = this._writeSyncConflictArtifacts(conflicts, { cursor, reason, at: nowIso })
    const entry = {
      id: uuid(),
      at: nowIso,
      reason,
      cursor: normalizeSyncCursor(cursor),
      conflicts: summaries,
    }
    const next = {
      formatVersion: typeof previous.formatVersion === 'number' ? previous.formatVersion : 1,
      worldId: normalizeSyncString(previous.worldId) || this.snapshot?.worldId || null,
      cursor: normalizeSyncCursor(previous.cursor),
      world: previous.world && typeof previous.world === 'object' ? previous.world : {},
      objects: previous.objects && typeof previous.objects === 'object' ? previous.objects : {},
      lastConflictSnapshots: [
        entry,
        ...(Array.isArray(previous.lastConflictSnapshots) ? previous.lastConflictSnapshots : []),
      ].slice(0, MAX_SYNC_CONFLICT_SNAPSHOTS),
      updatedAt: nowIso,
    }
    this.syncState = next
    this._writeFileAtomic(this.syncStateFile, JSON.stringify(next, null, 2) + '\n')
    return summaries
  }

  _markSyncConflictResolvedInState(conflictId, { use, at }) {
    const normalizedId = normalizeSyncString(conflictId)
    if (!normalizedId) return
    const previous = this.syncState && typeof this.syncState === 'object' ? this.syncState : null
    if (!previous || !Array.isArray(previous.lastConflictSnapshots)) return
    const resolvedAt = normalizeSyncString(at) || new Date().toISOString()
    let changed = false
    const nextSnapshots = previous.lastConflictSnapshots.map(snapshot => {
      if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.conflicts)) return snapshot
      let localChanged = false
      const nextConflicts = snapshot.conflicts.map(item => {
        if (!item || typeof item !== 'object') return item
        if (normalizeSyncString(item.artifactId) !== normalizedId) return item
        localChanged = true
        return {
          ...item,
          status: 'resolved',
          resolvedAt,
          resolvedWith: use,
        }
      })
      if (!localChanged) return snapshot
      changed = true
      return {
        ...snapshot,
        conflicts: nextConflicts,
      }
    })
    if (!changed) return
    const next = {
      ...previous,
      lastConflictSnapshots: nextSnapshots,
      updatedAt: resolvedAt,
    }
    this.syncState = next
    this._writeFileAtomic(this.syncStateFile, JSON.stringify(next, null, 2) + '\n')
  }

  _markSyncConflictArtifactResolved(conflictId, { use, summary } = {}) {
    const id = normalizeSyncString(conflictId)
    if (!id) return null
    const artifactPath = path.join(this.conflictsDir, `${id}.json`)
    const existing = readJson(artifactPath)
    if (!existing || typeof existing !== 'object') return null
    const resolvedAt = new Date().toISOString()
    const next = {
      ...existing,
      status: 'resolved',
      resolvedAt,
      resolvedWith: normalizeSyncString(use) || null,
      resolutionSummary: summary || null,
    }
    this._writeFileAtomic(artifactPath, JSON.stringify(next, null, 2) + '\n')
    this._markSyncConflictResolvedInState(id, { use, at: resolvedAt })
    return next
  }

  _canPromptSyncConflictResolution() {
    return !!process.stdin?.isTTY && !!process.stdout?.isTTY
  }

  async _promptSyncConflictResolutionLine(message) {
    if (!this._canPromptSyncConflictResolution()) return null
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    const answer = await new Promise(resolve => {
      rl.question(message, resolve)
    })
    rl.close()
    if (typeof answer !== 'string') return ''
    return answer.trim()
  }

  _collectOpenSyncConflictArtifacts(conflictIds = null) {
    if (!Array.isArray(conflictIds) || conflictIds.length === 0) {
      return this.listSyncConflictArtifacts({ includeResolved: false })
    }
    const artifacts = []
    const seen = new Set()
    for (const value of conflictIds) {
      const id = normalizeSyncString(value)
      if (!id || seen.has(id)) continue
      seen.add(id)
      const artifact = this.getSyncConflictArtifact(id)
      if (!artifact || typeof artifact !== 'object') continue
      if (normalizeSyncString(artifact.status) === 'resolved') continue
      artifacts.push(artifact)
    }
    return artifacts
  }

  _countOpenSyncConflictArtifacts(conflictIds = null) {
    return this._collectOpenSyncConflictArtifacts(conflictIds).length
  }

  _getSyncConflictFieldSummary(artifact, limit = 5) {
    const fields = []
    for (const item of Array.isArray(artifact?.unresolvedFields) ? artifact.unresolvedFields : []) {
      const normalized = normalizeSyncString(item?.path)
      if (!normalized) continue
      fields.push(normalized)
    }
    return formatNameList(fields, limit)
  }

  async _resolveSyncConflictsInBulk(artifacts, { use }) {
    let resolved = 0
    let failed = 0
    const normalizedUse = normalizeSyncString(use)
    for (const item of artifacts) {
      const id = normalizeSyncString(item?.id)
      if (!id) continue
      try {
        const result = await this.resolveSyncConflict(id, { use: normalizedUse })
        if (!result?.alreadyResolved) {
          resolved += 1
        }
      } catch (err) {
        failed += 1
        console.error(`❌ Failed to resolve conflict ${id}:`, err?.message || err)
      }
    }
    return {
      resolved,
      failed,
      skipped: 0,
      cancelled: false,
    }
  }

  async _resolveSyncConflictsOneByOne(artifacts) {
    let resolved = 0
    let failed = 0
    let skipped = 0
    let cancelled = false
    const total = artifacts.length

    outer: for (let index = 0; index < artifacts.length; index += 1) {
      const source = artifacts[index]
      const id = normalizeSyncString(source?.id)
      if (!id) continue
      const artifact = this.getSyncConflictArtifact(id)
      if (!artifact || normalizeSyncString(artifact.status) === 'resolved') continue

      const objectId = normalizeSyncString(artifact.objectId) || 'unknown'
      const unresolvedCount = Array.isArray(artifact.unresolvedFields) ? artifact.unresolvedFields.length : 0
      const fieldSummary = this._getSyncConflictFieldSummary(artifact)
      const hasMergedValue = artifact.merged !== null && artifact.merged !== undefined

      console.log('')
      console.log(`Conflict ${index + 1}/${total}: ${id}`)
      console.log(`  Kind: ${artifact.kind || 'unknown'} (${objectId})`)
      if (unresolvedCount > 0) {
        console.log(
          `  Fields: ${fieldSummary || `${unresolvedCount} field conflict${unresolvedCount === 1 ? '' : 's'}`}`
        )
      }

      while (true) {
        const prompt = hasMergedValue
          ? 'Choose [1=world, 2=project, 3=merged, s=skip, q=cancel]: '
          : 'Choose [1=world, 2=project, s=skip, q=cancel]: '
        const answer = ((await this._promptSyncConflictResolutionLine(prompt)) || '').toLowerCase()
        let use = null

        if (
          answer === '1' ||
          answer === 'w' ||
          answer === 'world' ||
          answer === 'remote' ||
          answer === 'accept-world'
        ) {
          use = 'remote'
        } else if (
          answer === '2' ||
          answer === 'p' ||
          answer === 'project' ||
          answer === 'local' ||
          answer === 'push-project'
        ) {
          use = 'local'
        } else if (hasMergedValue && (answer === '3' || answer === 'm' || answer === 'merged')) {
          use = 'merged'
        } else if (answer === 's' || answer === 'skip') {
          skipped += 1
          continue outer
        } else if (answer === 'q' || answer === 'quit' || answer === 'cancel' || answer === 'n' || answer === 'no') {
          cancelled = true
          break outer
        } else {
          console.log('Invalid choice. Enter 1, 2, 3, s, or q.')
          continue
        }

        try {
          const result = await this.resolveSyncConflict(id, { use })
          if (!result?.alreadyResolved) {
            resolved += 1
          }
        } catch (err) {
          failed += 1
          console.error(`❌ Failed to resolve conflict ${id}:`, err?.message || err)
        }
        continue outer
      }
    }

    return { resolved, failed, skipped, cancelled }
  }

  async promptAndResolveSyncConflicts({ conflictIds = null } = {}) {
    const artifacts = this._collectOpenSyncConflictArtifacts(conflictIds)
    if (artifacts.length === 0) {
      return {
        prompted: false,
        changed: false,
        cancelled: false,
        resolved: 0,
        failed: 0,
        skipped: 0,
        remaining: 0,
      }
    }
    if (!this._canPromptSyncConflictResolution()) {
      return {
        prompted: false,
        changed: false,
        cancelled: false,
        resolved: 0,
        failed: 0,
        skipped: 0,
        remaining: artifacts.length,
      }
    }

    console.log('')
    console.log(`⚠️  Sync conflicts detected (${artifacts.length}).`)
    console.log('Choose how to resolve:')
    console.log('  1) Accept all from world (runtime wins)')
    console.log('  2) Push all from project folder (project wins)')
    console.log('  3) Choose for each conflict one by one')
    console.log('  q) Cancel (resolve later with gamedev sync commands)')

    let strategy = null
    while (!strategy) {
      const answer = ((await this._promptSyncConflictResolutionLine('Selection [1/2/3/q]: ')) || '').toLowerCase()
      if (answer === '1' || answer === 'w' || answer === 'world' || answer === 'remote' || answer === 'accept-world') {
        strategy = 'remote'
        break
      }
      if (answer === '2' || answer === 'p' || answer === 'project' || answer === 'local' || answer === 'push-project') {
        strategy = 'local'
        break
      }
      if (answer === '3' || answer === 'e' || answer === 'each' || answer === 'interactive') {
        strategy = 'interactive'
        break
      }
      if (answer === 'q' || answer === 'quit' || answer === 'cancel' || answer === 'n' || answer === 'no') {
        strategy = 'cancel'
        break
      }
      console.log('Invalid choice. Enter 1, 2, 3, or q.')
    }

    if (strategy === 'cancel') {
      return {
        prompted: true,
        changed: false,
        cancelled: true,
        resolved: 0,
        failed: 0,
        skipped: 0,
        remaining: artifacts.length,
      }
    }

    const summary =
      strategy === 'interactive'
        ? await this._resolveSyncConflictsOneByOne(artifacts)
        : await this._resolveSyncConflictsInBulk(artifacts, { use: strategy })
    const resolved = typeof summary?.resolved === 'number' ? summary.resolved : 0
    const failed = typeof summary?.failed === 'number' ? summary.failed : 0
    const skipped = typeof summary?.skipped === 'number' ? summary.skipped : 0
    const cancelled = summary?.cancelled === true
    const remaining = this._countOpenSyncConflictArtifacts(artifacts.map(item => item.id))

    if (remaining > 0) {
      console.warn(`⚠️  ${remaining} sync conflict(s) still unresolved.`)
    } else {
      console.log('✅ Sync conflicts resolved.')
    }

    return {
      prompted: true,
      changed: resolved > 0,
      cancelled,
      resolved,
      failed,
      skipped,
      remaining,
    }
  }

  _readManifestForSyncResolve() {
    const manifest = this.manifest.read()
    if (manifest) return cloneJson(manifest)
    return this.manifest.createEmpty()
  }

  _upsertManifestEntity(manifest, entity) {
    const next = manifest && typeof manifest === 'object' ? manifest : this.manifest.createEmpty()
    const entities = Array.isArray(next.entities) ? next.entities.slice() : []
    const id = normalizeSyncString(entity?.id)
    if (!id) return next
    const index = entities.findIndex(item => item?.id === id)
    if (index >= 0) {
      entities[index] = entity
    } else {
      entities.push(entity)
    }
    next.entities = entities
    return next
  }

  _removeManifestEntity(manifest, entityId) {
    const next = manifest && typeof manifest === 'object' ? manifest : this.manifest.createEmpty()
    const id = normalizeSyncString(entityId)
    if (!id) return next
    next.entities = (Array.isArray(next.entities) ? next.entities : []).filter(item => item?.id !== id)
    return next
  }

  async _applyResolvedSettingsToRuntime(settings) {
    const current = normalizeSettingsForCompare(this.snapshot?.settings)
    const desired = normalizeSettingsForCompare(settings)
    const keys = new Set([...Object.keys(current), ...Object.keys(desired)])
    for (const key of keys) {
      if (isEqual(current[key], desired[key])) continue
      await this.client.request('settings_modify', { key, value: desired[key] })
    }
    this.snapshot.settings = cloneJson(desired)
  }

  async _applyResolvedSpawnToRuntime(spawn) {
    const desired = normalizeSpawnForCompare(spawn)
    const current = normalizeSpawnForCompare(this.snapshot?.spawn)
    if (!isEqual(current.position, desired.position) || !isEqual(current.quaternion, desired.quaternion)) {
      await this.client.setSpawn({
        position: desired.position,
        quaternion: desired.quaternion,
      })
    }
    this.snapshot.spawn = cloneJson(desired)
  }

  async _applyResolvedEntityToRuntime(id, entity) {
    const entityId = normalizeSyncString(id)
    if (!entityId) return
    const desired = entity ? normalizeEntityForCompare(entity) : null
    const existingRaw = this.snapshot?.entities?.get(entityId) || null
    const existing = normalizeEntityForCompare(existingRaw)

    if (!desired) {
      if (existingRaw) {
        await this.client.request('entity_remove', { id: entityId })
        this.snapshot.entities.delete(entityId)
      }
      return
    }

    if (!existingRaw) {
      const data = {
        id: entityId,
        type: 'app',
        blueprint: desired.blueprint,
        position: desired.position,
        quaternion: desired.quaternion,
        scale: desired.scale,
        mover: null,
        uploader: null,
        pinned: desired.pinned,
        props: desired.props,
        state: desired.state,
      }
      await this.client.request('entity_add', { entity: data })
      this.snapshot.entities.set(entityId, data)
      return
    }

    const change = { id: entityId }
    if (!isEqual(existing.blueprint, desired.blueprint)) change.blueprint = desired.blueprint
    if (!isEqual(existing.position, desired.position)) change.position = desired.position
    if (!isEqual(existing.quaternion, desired.quaternion)) change.quaternion = desired.quaternion
    if (!isEqual(existing.scale, desired.scale)) change.scale = desired.scale
    if (!isEqual(existing.pinned, desired.pinned)) change.pinned = desired.pinned
    if (!isEqual(existing.props, desired.props)) change.props = desired.props
    if (!isEqual(existing.state, desired.state)) change.state = desired.state

    if (Object.keys(change).length > 1) {
      await this.client.request('entity_modify', { change })
      this.snapshot.entities.set(entityId, { ...existingRaw, ...change })
    }
  }

  async _applyResolvedBlueprintToLocal({ id, blueprint, localIndex, includeScriptSources = false } = {}) {
    const blueprintId = normalizeSyncString(id)
    if (!blueprintId) return
    if (!blueprint) {
      this._removeLocalBlueprintFromDisk(blueprintId, { localIndex })
      return
    }
    const payload = normalizeBlueprintForCompare(blueprint)
    if (!payload) return
    await this._writeBlueprintToDisk({
      blueprint: payload,
      force: true,
      includeBuiltScripts: false,
      includeScriptSources,
      pruneScriptSources: false,
      localIndex,
    })
  }

  async resolveSyncConflict(conflictId, { use = 'local' } = {}) {
    const choice = normalizeSyncString(use)
    if (!['local', 'remote', 'merged'].includes(choice)) {
      throw new Error('invalid_resolve_mode')
    }
    const artifact = this.getSyncConflictArtifact(conflictId)
    if (!artifact) {
      throw new Error(`conflict_not_found:${conflictId}`)
    }
    if (normalizeSyncString(artifact.status) === 'resolved') {
      return { conflictId: artifact.id, alreadyResolved: true }
    }

    const objectId = normalizeSyncString(artifact.objectId)
    const localValue = cloneJson(artifact.local)
    const remoteValue = cloneJson(artifact.remote)
    const mergedValue = cloneJson(artifact.merged)
    let selectedValue = null
    if (choice === 'local') selectedValue = localValue
    if (choice === 'remote') selectedValue = remoteValue
    if (choice === 'merged') selectedValue = mergedValue
    if (choice === 'merged' && selectedValue == null) {
      throw new Error('conflict_missing_merged_value')
    }

    const localIndex = this._indexLocalBlueprints()
    let manifest = null

    switch (artifact.kind) {
      case 'settings': {
        const desired = normalizeSettingsForCompare(selectedValue)
        manifest = this._readManifestForSyncResolve()
        manifest.settings = desired
        this._writeWorldFile(manifest)
        if (choice !== 'remote') {
          await this._applyResolvedSettingsToRuntime(desired)
        }
        break
      }
      case 'spawn': {
        const desired = normalizeSpawnForCompare(selectedValue)
        manifest = this._readManifestForSyncResolve()
        manifest.spawn = desired
        this._writeWorldFile(manifest)
        if (choice !== 'remote') {
          await this._applyResolvedSpawnToRuntime(desired)
        }
        break
      }
      case 'entity': {
        const entityId = objectId || normalizeSyncString(selectedValue?.id)
        if (!entityId) throw new Error('conflict_missing_entity_id')
        const desired = selectedValue ? normalizeEntityForCompare(selectedValue) : null
        manifest = this._readManifestForSyncResolve()
        if (desired) {
          manifest = this._upsertManifestEntity(manifest, desired)
        } else {
          manifest = this._removeManifestEntity(manifest, entityId)
        }
        this._writeWorldFile(manifest)
        if (choice !== 'remote') {
          await this._applyResolvedEntityToRuntime(entityId, desired)
        }
        if (choice === 'remote') {
          if (desired) this.snapshot.entities.set(entityId, desired)
          else this.snapshot.entities.delete(entityId)
        }
        break
      }
      case 'blueprint': {
        const blueprintId = objectId || normalizeSyncString(selectedValue?.id)
        if (!blueprintId) throw new Error('conflict_missing_blueprint_id')
        if (choice === 'remote') {
          await this._applyResolvedBlueprintToLocal({
            id: blueprintId,
            blueprint: remoteValue,
            localIndex,
            includeScriptSources: true,
          })
          if (remoteValue) this.snapshot.blueprints.set(blueprintId, remoteValue)
          else this.snapshot.blueprints.delete(blueprintId)
        } else if (choice === 'local') {
          if (localValue) {
            if (!localIndex.has(blueprintId)) {
              await this._applyResolvedBlueprintToLocal({
                id: blueprintId,
                blueprint: localValue,
                localIndex,
                includeScriptSources: false,
              })
            }
            await this._deployBlueprintById(blueprintId)
          } else {
            this._removeLocalBlueprintFromDisk(blueprintId, { localIndex })
            await this._removeBlueprintsAndEntities([blueprintId])
          }
        } else {
          await this._applyResolvedBlueprintToLocal({
            id: blueprintId,
            blueprint: mergedValue,
            localIndex,
            includeScriptSources: false,
          })
          if (mergedValue) {
            await this._deployBlueprintById(blueprintId)
          } else {
            await this._removeBlueprintsAndEntities([blueprintId])
          }
        }
        break
      }
      default:
        throw new Error(`unsupported_conflict_kind:${artifact.kind}`)
    }

    const finalCursor = await this._getRuntimeHeadCursor({ fallback: this.syncState?.cursor })
    const next = this._buildSyncStateSnapshot({ cursor: finalCursor })
    this._writeSyncState(next)
    this._markSyncConflictArtifactResolved(artifact.id, {
      use: choice,
      summary: {
        kind: artifact.kind,
        objectId: artifact.objectId,
      },
    })

    return {
      conflictId: artifact.id,
      kind: artifact.kind,
      objectId: artifact.objectId,
      use: choice,
    }
  }

  async _runStartupHandshake(manifest, { reason = 'startup' } = {}) {
    const initialCursor = await this._getRuntimeHeadCursor({ fallback: this.syncState?.cursor })
    let localIndex = this._indexLocalBlueprints()
    let localBlueprints = await this._buildLocalBlueprintPayloadIndex(localIndex)
    let plan = this._computeStartupHandshakePlan({ manifest, localBlueprints })

    if (plan.conflicts.length > 0) {
      const conflictSummaries = this._recordSyncConflicts(plan.conflicts, { cursor: initialCursor, reason })
      if (this._isStrictSyncConflictsEnabled()) {
        const promptResult = await this.promptAndResolveSyncConflicts({
          conflictIds: conflictSummaries.map(item => item.artifactId),
        })
        if (promptResult.changed || (promptResult.prompted && !promptResult.cancelled)) {
          const refreshedManifest = this.manifest.read() || manifest
          localIndex = this._indexLocalBlueprints()
          localBlueprints = await this._buildLocalBlueprintPayloadIndex(localIndex)
          plan = this._computeStartupHandshakePlan({ manifest: refreshedManifest, localBlueprints })
        }
        const conflictKinds = Array.from(new Set(plan.conflicts.map(conflict => conflict.kind))).join(', ')
        if (plan.conflicts.length > 0) {
          throw new Error(
            `Sync conflict detected (${plan.conflicts.length} object${plan.conflicts.length === 1 ? '' : 's'}: ${conflictKinds}). ` +
              'Inspect with "gamedev sync conflicts" and resolve via "gamedev sync resolve <id> --use ...".'
          )
        }
      }
      if (plan.conflicts.length > 0) {
        console.warn(
          `⚠️  Sync conflicts detected (${plan.conflicts.length}); unresolved objects were skipped and written to .lobby/conflicts/.`
        )
      }
    }

    await this._withDeferredSyncStateWrites(async () => {
      if (plan.blueprints.remoteOnlyUpserts.length || plan.blueprints.remoteOnlyRemovals.length) {
        await this._applyRemoteOnlyBlueprintChanges(plan, localIndex)
      }

      if (plan.blueprints.mergedActions.length) {
        await this._applyMergedBlueprintChanges(plan, localIndex)
      }

      if (plan.manifest.remoteOnly) {
        this._writeWorldFile(plan.mergedManifest)
      }

      if (plan.blueprints.localOnlyUpserts.length || plan.blueprints.localOnlyRemovals.length) {
        await this._pushLocalOnlyBlueprintChanges(plan, localIndex)
      }

      if (plan.manifest.localOnly) {
        await this._applyManifestToWorld(plan.mergedManifest)
      }
    })

    const finalCursor = await this._getRuntimeHeadCursor({ fallback: initialCursor })
    const next = this._buildSyncStateSnapshot({ cursor: finalCursor })
    this._writeSyncState(next)
  }

  async start() {
    ensureDir(this.appsDir)
    ensureDir(this.assetsDir)

    const bidirectionalSync = this._isBidirectionalSyncEnabled()
    const snapshot = await this.connect(
      bidirectionalSync
        ? {
            refreshSyncState: false,
            syncCursorFromChangefeed: false,
          }
        : {}
    )

    const hasWorldFile = fs.existsSync(this.worldFile)
    const hasApps = this._hasLocalApps()

    if (!hasWorldFile && !hasApps) {
      await this._bootstrapEmptyProject(snapshot)
    } else if (!hasWorldFile && hasApps) {
      throw new Error(
        'world.json missing; cannot safely apply exact world layout. ' +
          'Run "gamedev world export" to generate it from the world, or create world.json to seed a new world.'
      )
    } else {
      const manifest = this.manifest.read()
      if (!manifest) {
        throw new Error('world.json is missing or invalid JSON.')
      }
      const errors = this.manifest.validate(manifest)
      if (errors.length) {
        throw new Error(`Invalid world.json:\n- ${errors.join('\n- ')}`)
      }
      if (bidirectionalSync) {
        await this._runStartupHandshake(manifest, { reason: 'startup' })
      } else {
        await this._deployAllBlueprints()
        await this._applyManifestToWorld(manifest)
      }
    }

    this._startWatchers()
    this._attachRemoteHandlers()
    this.client.on('disconnect', () => {
      this._startReconnectLoop()
    })
    console.log(`✅ Connected to ${this.worldUrl} (/admin)`)
  }

  async _bootstrapEmptyProject(snapshot) {
    if (!this._isDefaultWorldSnapshot(snapshot)) {
      const err = new Error(
        'Local project is empty and this world already has content. ' +
          'Script code is not downloaded by default. ' +
          'Run "gamedev world export" to scaffold from the world (use --include-built-scripts for legacy apps).'
      )
      err.code = 'empty_project_requires_export'
      throw err
    }
    const manifest = await this._scaffoldLocalProject()
    await this._deployAllBlueprints()
    await this._applyManifestToWorld(manifest)
  }

  _isDefaultWorldSnapshot(snapshot) {
    const blueprints = Array.isArray(snapshot?.blueprints) ? snapshot.blueprints : []
    for (const blueprint of blueprints) {
      if (!blueprint?.id) continue
      if (!BUILTIN_BLUEPRINT_IDS.has(blueprint.id)) return false
    }
    const entities = Array.isArray(snapshot?.entities) ? snapshot.entities : []
    const appEntities = entities.filter(entity => entity?.type === 'app')
    if (appEntities.length > 1) return false
    if (appEntities.length === 1 && appEntities[0].blueprint !== SCENE_TEMPLATE.fileBase) return false
    return true
  }

  async _scaffoldLocalProject() {
    scaffoldBaseProject({ rootDir: this.rootDir, writeFile: this._writeFileAtomic.bind(this) })
    const { manifest } = scaffoldBuiltins({ rootDir: this.rootDir, writeFile: this._writeFileAtomic.bind(this) })
    this._writeWorldFile(manifest)
    return manifest
  }

  async stop() {
    this.reconnecting = false
    if (this.pendingManifestWrite) {
      clearTimeout(this.pendingManifestWrite)
      this.pendingManifestWrite = null
    }
    for (const timer of this.deployTimers.values()) {
      clearTimeout(timer)
    }
    this.deployTimers.clear()
    const watcherKeys = Array.from(this.watchers.keys())
    for (const key of watcherKeys) {
      this._closeWatcher(key)
    }
    try {
      this.client?.removeAllListeners?.('disconnect')
    } catch {}
    try {
      this.client?.ws?.close()
    } catch {}
  }

  async exportWorldToDisk(snapshot = this.snapshot, { includeBuiltScripts = false, includeScriptSources = true } = {}) {
    const rawSnapshot = snapshot || (await this.client.getSnapshot())
    const nextSnapshot = this._normalizeSnapshotForExport(rawSnapshot)
    this.assetsUrl = nextSnapshot.assetsUrl
    if (!this.snapshot) this._initSnapshot(nextSnapshot)

    const manifest = this.manifest.fromSnapshot(nextSnapshot)
    this._writeWorldFile(manifest)

    const blueprints = Array.isArray(nextSnapshot.blueprints) ? nextSnapshot.blueprints : []
    const localIndex = this._indexLocalBlueprints()
    const scriptGroups = buildScriptGroupIndex(blueprints)
    const syncedScriptKeys = new Set()
    for (const blueprint of blueprints) {
      if (!blueprint?.id) continue
      const scriptRoot = this._resolveRemoteScriptRootBlueprint(blueprint)
      let shouldSyncScriptSources = false
      const scriptKey = getScriptKey(scriptRoot || blueprint)
      if (includeScriptSources && scriptKey && !syncedScriptKeys.has(scriptKey)) {
        shouldSyncScriptSources = true
        syncedScriptKeys.add(scriptKey)
      }
      await this._writeBlueprintToDisk({
        blueprint,
        force: true,
        includeBuiltScripts,
        includeScriptSources: shouldSyncScriptSources,
        pruneScriptSources: shouldSyncScriptSources,
        allowScriptOverwrite: includeBuiltScripts,
        scriptRoot,
        localIndex,
        scriptGroups,
      })
    }
  }

  async importWorldFromDisk() {
    const manifest = this.manifest.read()
    if (!manifest) {
      throw new Error('world.json missing. Run "gamedev world export" to generate it first.')
    }
    const errors = this.manifest.validate(manifest)
    if (errors.length) {
      throw new Error(`Invalid world.json:\n- ${errors.join('\n- ')}`)
    }
    await this._deployAllBlueprints()
    await this._applyManifestToWorld(manifest)
  }

  async deployApp(appName, options = {}) {
    await this._deployBlueprintsForApp(appName, null, null, { preview: true, ...options })
  }

  async deployBlueprint(id) {
    await this._deployBlueprintById(id)
  }

  _logTarget() {
    if (this.loggedTarget) return
    const worldId = this.snapshot?.worldId || 'unknown'
    console.log(`Deploy target: ${this.worldUrl} (worldId: ${worldId})`)
    this.loggedTarget = true
  }

  async _startReconnectLoop() {
    if (this.reconnecting) return
    this.reconnecting = true
    let delay = 500
    while (this.reconnecting) {
      try {
        console.warn(`⚠️  Disconnected from ${this.worldUrl}, reconnecting...`)
        const bidirectionalSync = this._isBidirectionalSyncEnabled()
        const snapshot = await this.connect(
          bidirectionalSync
            ? {
                refreshSyncState: false,
                syncCursorFromChangefeed: false,
              }
            : {}
        )
        if (!fs.existsSync(this.worldFile) && !this._hasLocalApps()) {
          try {
            await this._bootstrapEmptyProject(snapshot)
          } catch (err) {
            if (err?.code === 'empty_project_requires_export') {
              console.error(`❌ ${err.message}`)
              this.reconnecting = false
              return
            }
            throw err
          }
        } else if (fs.existsSync(this.worldFile)) {
          const manifest = this.manifest.read()
          if (!manifest) {
            throw new Error('world.json is missing or invalid JSON.')
          }
          const errors = this.manifest.validate(manifest)
          if (errors.length) {
            throw new Error(`Invalid world.json:\n- ${errors.join('\n- ')}`)
          }
          if (bidirectionalSync) {
            await this._runStartupHandshake(manifest, { reason: 'reconnect' })
          } else {
            await this._deployAllBlueprints()
            await this._applyManifestToWorld(manifest)
          }
        }
        console.log(`✅ Reconnected to ${this.worldUrl} (/admin)`)
        this.reconnecting = false
        return
      } catch (err) {
        await sleep(delay)
        delay = Math.min(delay * 2, 10000)
      }
    }
  }

  _hasLocalApps() {
    const blueprints = this._indexLocalBlueprints()
    return blueprints.size > 0
  }

  _indexLocalBlueprints() {
    const index = new Map()
    const pathIndex = new Map()
    const identityLookup = this._buildBlueprintIdentityLookup()
    if (!fs.existsSync(this.appsDir)) {
      this.localBlueprintPathIndex = pathIndex
      this._syncBlueprintIdentityIndex(index)
      return index
    }

    for (const appName of listSubdirs(this.appsDir)) {
      const appPath = path.join(this.appsDir, appName)
      const entries = fs.existsSync(appPath) ? fs.readdirSync(appPath, { withFileTypes: true }) : []
      const scriptPath = this._getScriptPath(appName)

      for (const entry of entries) {
        if (!entry.isFile()) continue
        if (!entry.name.endsWith('.json')) continue
        if (isBlueprintDenylist(entry.name)) continue
        const fileBase = path.basename(entry.name, '.json')
        const configPath = path.join(appPath, entry.name)
        const cfg = readJson(configPath)
        const id = this._resolveIndexedBlueprintId({
          appName,
          fileBase,
          cfg,
          configPath,
          identityLookup,
        })
        if (!id) continue
        const uid = this._resolveIndexedBlueprintUid({ id, cfg, identityLookup })
        const createdAt = typeof cfg?.createdAt === 'string' ? cfg.createdAt : null
        const scriptKey = typeof cfg?.script === 'string' ? cfg.script.trim() : ''
        const keep = cfg?.keep === true
        const relativeConfigPath = toProjectRelativePath(this.rootDir, configPath)
        const identitySignature = buildBlueprintIdentitySignature(cfg)
        const info = {
          id,
          uid,
          appName,
          fileBase,
          configPath,
          relativeConfigPath,
          scriptPath,
          createdAt,
          scriptKey,
          keep,
          identitySignature,
        }
        const existing = index.get(id)
        if (existing && existing.configPath !== configPath) {
          console.warn(
            `⚠️  Duplicate blueprint id "${id}" at ${existing.configPath} and ${configPath}; using ${existing.configPath}.`
          )
          continue
        }
        index.set(id, info)
        pathIndex.set(configPath, info)

        identityLookup.byId.set(id, {
          id,
          uid: uid || null,
          path: relativeConfigPath || null,
          signature: identitySignature || null,
        })
        if (uid) {
          identityLookup.byUid.set(uid, id)
        }
        if (relativeConfigPath) {
          identityLookup.byPath.set(relativeConfigPath, {
            id,
            uid: uid || null,
            path: relativeConfigPath,
            signature: identitySignature || null,
          })
        }
        if (identitySignature) {
          identityLookup.bySignature.set(identitySignature, {
            id,
            uid: uid || null,
            path: relativeConfigPath || null,
            signature: identitySignature,
          })
        }
      }
    }

    this.localBlueprintPathIndex = pathIndex
    this._syncBlueprintIdentityIndex(index)
    return index
  }

  _getScriptPath(appName) {
    const appPath = path.join(this.appsDir, appName)
    const configuredEntries = this._getConfiguredScriptEntries(appName)
    const snapshotEntry = this._getSnapshotScriptEntry(appName)
    if (snapshotEntry && !configuredEntries.includes(snapshotEntry)) {
      configuredEntries.push(snapshotEntry)
    }
    for (const relPath of configuredEntries) {
      const resolved = this._resolveScriptEntryPath(appPath, relPath)
      if (resolved) return resolved
    }
    const tsPath = path.join(appPath, 'index.ts')
    const jsPath = path.join(appPath, 'index.js')
    if (fs.existsSync(tsPath)) return tsPath
    if (fs.existsSync(jsPath)) return jsPath
    const localScripts = listScriptFiles(appPath)
    if (localScripts.length === 1) {
      return localScripts[0].absPath
    }
    return null
  }

  _getConfiguredScriptEntries(appName) {
    const appPath = path.join(this.appsDir, appName)
    if (!fs.existsSync(appPath)) return []
    const entries = []
    const seen = new Set()
    const addEntry = value => {
      const raw = normalizeSyncString(value)
      if (!raw) return
      const normalized = normalizeScriptRelPath(raw)
      if (!isValidScriptPath(normalized)) return
      if (seen.has(normalized)) return
      seen.add(normalized)
      entries.push(normalized)
    }

    const primaryFilename = `${appName}.json`
    addEntry(readJson(path.join(appPath, primaryFilename))?.scriptEntry)

    let files = []
    try {
      files = fs.readdirSync(appPath, { withFileTypes: true })
    } catch {
      return entries
    }
    for (const entry of files) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.json') || isBlueprintDenylist(entry.name)) continue
      if (entry.name === primaryFilename) continue
      addEntry(readJson(path.join(appPath, entry.name))?.scriptEntry)
    }

    return entries
  }

  _getSnapshotScriptEntry(appName) {
    if (!this.snapshot?.blueprints) return null
    const candidateIds = new Set()

    if (this.localBlueprintPathIndex?.size) {
      for (const info of this.localBlueprintPathIndex.values()) {
        if (info?.appName !== appName || !info?.id) continue
        candidateIds.add(info.id)
      }
    }

    if (!candidateIds.size) {
      for (const blueprint of this.snapshot.blueprints.values()) {
        if (!blueprint?.id) continue
        if (parseBlueprintId(blueprint.id).appName === appName) {
          candidateIds.add(blueprint.id)
        }
      }
    }

    for (const id of candidateIds) {
      const blueprint = this.snapshot.blueprints.get(id)
      if (!blueprint) continue
      const scriptRoot = this._resolveRemoteScriptRootBlueprint(blueprint) || blueprint
      const rawEntry = normalizeSyncString(scriptRoot?.scriptEntry)
      if (!rawEntry) continue
      const normalized = normalizeScriptRelPath(rawEntry)
      if (!isValidScriptPath(normalized)) continue
      return normalized
    }
    return null
  }

  _resolveScriptEntryPath(appPath, relPath) {
    const normalized = normalizeScriptRelPath(relPath)
    if (!isValidScriptPath(normalized)) return null

    const resolveIfFile = candidate => {
      if (!candidate || !fs.existsSync(candidate)) return null
      let stats = null
      try {
        stats = fs.statSync(candidate)
      } catch {
        return null
      }
      return stats?.isFile() ? candidate : null
    }

    const directPath = resolveIfFile(path.join(appPath, normalized))
    if (directPath) return directPath

    const ext = path.extname(normalized).toLowerCase()
    if (ext === '.js') {
      return resolveIfFile(path.join(appPath, `${normalized.slice(0, -3)}.ts`))
    }
    if (ext === '.ts') {
      return resolveIfFile(path.join(appPath, `${normalized.slice(0, -3)}.js`))
    }
    return null
  }

  _getScriptFormat(appName) {
    const appPath = path.join(this.appsDir, appName)
    const primaryPath = path.join(appPath, `${appName}.json`)
    const primaryFormat = normalizeScriptFormat(readJson(primaryPath)?.scriptFormat)
    if (primaryFormat) return primaryFormat
    if (!fs.existsSync(appPath)) return null
    const entries = fs.readdirSync(appPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.json') || isBlueprintDenylist(entry.name)) continue
      const cfg = readJson(path.join(appPath, entry.name))
      const format = normalizeScriptFormat(cfg?.scriptFormat)
      if (format) return format
    }
    return null
  }

  _syncScriptFormatForApp(appName, nextFormat) {
    const format = normalizeScriptFormat(nextFormat)
    if (!format) return 0
    const appPath = path.join(this.appsDir, appName)
    if (!fs.existsSync(appPath)) return 0
    let updated = 0
    const entries = fs.readdirSync(appPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.json') || isBlueprintDenylist(entry.name)) continue
      const configPath = path.join(appPath, entry.name)
      const cfg = readJson(configPath)
      if (!cfg || typeof cfg !== 'object') continue
      if (normalizeScriptFormat(cfg.scriptFormat) === format) continue
      const nextCfg = {
        ...cfg,
        scriptFormat: format,
      }
      this._writeFileAtomic(configPath, JSON.stringify(nextCfg, null, 2) + '\n')
      updated += 1
    }
    return updated
  }

  _resolveAppScriptMode(appName) {
    const appPath = path.join(this.appsDir, appName)
    const entryPath = this._getScriptPath(appName)
    const scriptFormat = this._getScriptFormat(appName)
    const appFiles = listScriptFiles(appPath)
    const sharedRelPaths = collectSharedDependencies(appFiles, this.sharedDir)
    const sharedFiles = buildSharedFileEntries(sharedRelPaths, this.sharedDir)
    const filesByRelPath = new Map()
    for (const file of appFiles) {
      const relPath = normalizeScriptRelPath(file.relPath)
      filesByRelPath.set(relPath, { ...file, relPath })
    }
    for (const file of sharedFiles) {
      const relPath = normalizeScriptRelPath(file.relPath)
      if (filesByRelPath.has(relPath)) {
        console.warn(`⚠️  Shared script path conflicts with app file: ${appName}/${relPath}`)
        continue
      }
      filesByRelPath.set(relPath, { ...file, relPath })
    }
    return {
      appPath,
      entryPath,
      files: Array.from(filesByRelPath.values()).sort((a, b) => a.relPath.localeCompare(b.relPath)),
      scriptFormat,
      sharedRelPaths,
    }
  }

  _writeWorldFile(manifest) {
    if (isEqual(this.manifest.data, manifest)) return
    this._writeFileAtomic(this.worldFile, JSON.stringify(manifest, null, 2) + '\n')
    this.manifest.data = manifest
  }

  _startWatchers() {
    this._watchAppsDir()
    this._watchAssetsDir()
    this._watchSharedDir()
    this._watchWorldFile()
    for (const appName of listSubdirs(this.appsDir)) {
      this._watchAppDir(appName)
    }
  }

  _watchAppsDir() {
    if (this.watchers.has('appsDir')) return
    if (!fs.existsSync(this.appsDir)) return
    const watcher = fs.watch(this.appsDir, { recursive: false }, (eventType, filename) => {
      if (eventType !== 'rename' || !filename) return
      const abs = path.join(this.appsDir, filename)
      if (!fs.existsSync(abs)) {
        this._closeWatchersUnderDir(abs)
        this._scheduleRemoveApp(filename, abs)
        return
      }
      if (!fs.statSync(abs).isDirectory()) return
      this._watchAppDir(filename)
      // New app directories can already contain files before nested watchers attach.
      this._scheduleDeployApp(filename)
    })
    this.watchers.set('appsDir', watcher)
  }

  _watchAppDir(appName) {
    const appPath = path.join(this.appsDir, appName)
    if (!fs.existsSync(appPath)) return
    this._watchAppDirRecursive(appName, appPath, appPath)
  }

  _watchAppDirRecursive(appName, dirPath, rootPath) {
    if (dirPath !== rootPath && SCRIPT_DIR_SKIP.has(path.basename(dirPath))) return
    this._watchAppPath(appName, dirPath, rootPath)
    let entries = []
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (SCRIPT_DIR_SKIP.has(entry.name)) continue
      this._watchAppDirRecursive(appName, path.join(dirPath, entry.name), rootPath)
    }
  }

  _watchAppPath(appName, dirPath, rootPath) {
    if (this.watchers.has(dirPath)) return
    const watcher = fs.watch(dirPath, { recursive: false }, (eventType, filename) => {
      if (!filename) return
      const abs = path.join(dirPath, filename)
      if (this.pendingWrites.has(abs)) return
      if (!fs.existsSync(abs) && eventType === 'change') return

      if (eventType === 'rename') {
        if (fs.existsSync(abs)) {
          let stats = null
          try {
            stats = fs.statSync(abs)
          } catch {}
          if (stats?.isDirectory()) {
            if (SCRIPT_DIR_SKIP.has(path.basename(abs))) return
            this._watchAppDirRecursive(appName, abs, rootPath)
            return
          }
        } else {
          this._closeWatchersUnderDir(abs)
        }
      }

      if (dirPath === rootPath && filename.endsWith('.json') && !isBlueprintDenylist(filename)) {
        const fileBase = path.basename(filename, '.json')
        if (!fs.existsSync(abs)) {
          const cached = this.localBlueprintPathIndex.get(abs)
          const id = cached?.id || deriveBlueprintId(appName, fileBase)
          this._scheduleRemoveBlueprint(id, abs)
          return
        }
        this._indexLocalBlueprints()
        const info = this.localBlueprintPathIndex.get(abs)
        const id = info?.id || deriveBlueprintId(appName, fileBase)
        this._scheduleDeployBlueprint(id)
        return
      }

      if (isScriptFilename(filename)) {
        this._scheduleDeployApp(appName)
      }
    })
    this.watchers.set(dirPath, watcher)
  }

  _watchSharedDir() {
    if (this.watchers.has(this.sharedDir)) return
    if (!fs.existsSync(this.sharedDir)) {
      if (this.watchers.has('sharedRoot')) return
      if (!fs.existsSync(this.rootDir)) return
      const watcher = fs.watch(this.rootDir, { recursive: false }, (eventType, filename) => {
        if (eventType !== 'rename' || filename !== SHARED_DIR_NAME) return
        const abs = path.join(this.rootDir, filename)
        if (!fs.existsSync(abs)) return
        if (!fs.statSync(abs).isDirectory()) return
        this._closeWatcher('sharedRoot')
        this._watchSharedDir()
      })
      this.watchers.set('sharedRoot', watcher)
      return
    }
    this._watchSharedDirRecursive(this.sharedDir, this.sharedDir)
  }

  _watchSharedDirRecursive(dirPath, rootPath) {
    if (dirPath !== rootPath && SCRIPT_DIR_SKIP.has(path.basename(dirPath))) return
    this._watchSharedPath(dirPath, rootPath)
    let entries = []
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (SCRIPT_DIR_SKIP.has(entry.name)) continue
      this._watchSharedDirRecursive(path.join(dirPath, entry.name), rootPath)
    }
  }

  _watchSharedPath(dirPath, rootPath) {
    if (this.watchers.has(dirPath)) return
    const watcher = fs.watch(dirPath, { recursive: false }, (eventType, filename) => {
      if (!filename) return
      const abs = path.join(dirPath, filename)
      if (this.pendingWrites.has(abs)) return
      if (!fs.existsSync(abs) && eventType === 'change') return

      if (eventType === 'rename') {
        if (fs.existsSync(abs)) {
          let stats = null
          try {
            stats = fs.statSync(abs)
          } catch {}
          if (stats?.isDirectory()) {
            if (SCRIPT_DIR_SKIP.has(path.basename(abs))) return
            this._watchSharedDirRecursive(abs, rootPath)
            return
          }
        } else {
          this._closeWatchersUnderDir(abs)
        }
      }

      if (!isScriptFilename(filename)) return
      const rel = normalizeScriptRelPath(path.relative(rootPath, abs))
      if (!rel) return
      const sharedRelPath = `${SHARED_IMPORT_PREFIX}${rel}`
      this._scheduleDeployAppsForSharedPath(sharedRelPath)
    })
    this.watchers.set(dirPath, watcher)
  }

  _scheduleDeployAppsForSharedPath(sharedRelPath) {
    const canonical = normalizeSharedSpecifier(sharedRelPath)
    if (!canonical) return
    const targets = this._getAppsUsingSharedPath(canonical)
    if (!targets.length) return
    for (const appName of targets) {
      this._scheduleDeployApp(appName)
    }
  }

  _getAppsUsingSharedPath(sharedRelPath) {
    if (!sharedRelPath) return []
    const apps = []
    for (const appName of listSubdirs(this.appsDir)) {
      const modeInfo = this._resolveAppScriptMode(appName)
      if (!modeInfo?.sharedRelPaths?.has(sharedRelPath)) continue
      apps.push(appName)
    }
    return apps
  }

  _closeWatcher(key) {
    const watcher = this.watchers.get(key)
    if (!watcher) return
    try {
      watcher.close()
    } catch {}
    this.watchers.delete(key)
  }

  _closeWatchersUnderDir(dirPath) {
    const prefix = dirPath.endsWith(path.sep) ? dirPath : `${dirPath}${path.sep}`
    for (const key of Array.from(this.watchers.keys())) {
      if (key === dirPath || key.startsWith(prefix)) {
        this._closeWatcher(key)
      }
    }
  }

  _scheduleRemoveApp(appName, appPath) {
    const previousIds = this._getBlueprintIdsForApp(appName)
    const key = `remove:app:${appName}`
    if (this.removeTimers.has(key)) clearTimeout(this.removeTimers.get(key))
    const timer = setTimeout(() => {
      this.removeTimers.delete(key)
      if (appPath && fs.existsSync(appPath)) return
      const localIndex = this._indexLocalBlueprints()
      const removals = previousIds.filter(id => !localIndex.has(id))
      if (!removals.length) return
      this._removeBlueprintsAndEntities(removals).catch(err => {
        console.warn(`⚠️  Failed to remove app ${appName} from world:`, err?.message || err)
      })
    }, 200)
    this.removeTimers.set(key, timer)
  }

  _scheduleRemoveBlueprint(id, configPath) {
    const normalizedId = normalizeSyncString(id)
    if (!normalizedId) return
    const key = `remove:blueprint:${normalizedId}`
    if (this.removeTimers.has(key)) clearTimeout(this.removeTimers.get(key))
    const timer = setTimeout(() => {
      this.removeTimers.delete(key)
      if (configPath && fs.existsSync(configPath)) return
      const localIndex = this._indexLocalBlueprints()
      if (localIndex.has(normalizedId)) return
      this._removeBlueprintsAndEntities([normalizedId]).catch(err => {
        console.warn(`⚠️  Failed to remove blueprint ${normalizedId}:`, err?.message || err)
      })
    }, 200)
    this.removeTimers.set(key, timer)
  }

  _getBlueprintIdsForApp(appName) {
    const ids = new Set()
    if (this.localBlueprintPathIndex?.size) {
      for (const info of this.localBlueprintPathIndex.values()) {
        if (info?.appName === appName && info.id) {
          ids.add(info.id)
        }
      }
    }
    if (ids.size) return Array.from(ids)
    if (!this.snapshot?.blueprints) return []
    for (const id of this.snapshot.blueprints.keys()) {
      const parsed = parseBlueprintId(id)
      if (parsed.appName === appName) {
        ids.add(id)
      }
    }
    return Array.from(ids)
  }

  async _removeBlueprintsAndEntities(blueprintIds) {
    if (!Array.isArray(blueprintIds) || blueprintIds.length === 0) return
    const ids = Array.from(new Set(blueprintIds)).filter(Boolean)
    if (!ids.length) return

    const entityIds = []
    if (this.snapshot?.entities) {
      for (const entity of this.snapshot.entities.values()) {
        if (entity?.type !== 'app') continue
        if (ids.includes(entity.blueprint)) {
          entityIds.push(entity.id)
        }
      }
    }

    for (const id of entityIds) {
      try {
        await this.client.request('entity_remove', { id })
        this.snapshot?.entities?.delete(id)
      } catch (err) {
        const code = err?.code || err?.message
        if (code === 'not_found') {
          this.snapshot?.entities?.delete(id)
          continue
        }
        console.warn(`⚠️  Failed to remove entity ${id}:`, err?.message || err)
      }
    }

    for (const id of ids) {
      try {
        await this.client.removeBlueprint(id)
        this.snapshot?.blueprints?.delete(id)
      } catch (err) {
        const code = err?.code || err?.message
        if (code === 'not_found') {
          this.snapshot?.blueprints?.delete(id)
          continue
        }
        if (code === 'in_use') {
          console.warn(`⚠️  Blueprint ${id} is still in use and was not removed.`)
          continue
        }
        console.warn(`⚠️  Failed to remove blueprint ${id}:`, err?.message || err)
      }
    }

    this._refreshSyncState()
  }

  async _removeAppFromWorld(appName) {
    const ids = this._getBlueprintIdsForApp(appName)
    if (!ids.length) return
    await this._removeBlueprintsAndEntities(ids)
  }

  _watchWorldFile() {
    if (this.watchers.has('worldFile')) return
    if (!fs.existsSync(this.rootDir)) return
    const filename = path.basename(this.worldFile)
    const watcher = fs.watch(this.rootDir, { recursive: false }, (eventType, changed) => {
      if (eventType !== 'change' && eventType !== 'rename') return
      if (!changed || path.basename(changed) !== filename) return
      if (this.pendingWrites.has(this.worldFile)) return
      if (!fs.existsSync(this.worldFile)) return
      this._onWorldFileChanged()
    })
    this.watchers.set('worldFile', watcher)
  }

  _watchAssetsDir() {
    if (this.watchers.has('assetsDir')) return
    if (!fs.existsSync(this.assetsDir)) return
    const watcher = fs.watch(this.assetsDir, { recursive: false }, (eventType, filename) => {
      if (!filename) return
      if (eventType !== 'change') return
      const rel = path.posix.join('assets', filename)
      const abs = path.join(this.assetsDir, filename)
      if (this.pendingWrites.has(abs)) return
      this._onAssetChanged(rel)
    })
    this.watchers.set('assetsDir', watcher)
  }

  _scheduleManifestWrite() {
    if (this.pendingManifestWrite) clearTimeout(this.pendingManifestWrite)
    this.pendingManifestWrite = setTimeout(() => {
      this.pendingManifestWrite = null
      void this._writeManifestFromSnapshot().catch(err => {
        console.warn('⚠️  Failed to refresh world.json assets:', err?.message || err)
      })
    }, 250)
  }

  async _writeManifestFromSnapshot() {
    if (!this.snapshot) return
    const data = {
      settings: this.snapshot.settings,
      spawn: this.snapshot.spawn,
      entities: Array.from(this.snapshot.entities.values()),
    }
    const manifest = this.manifest.fromSnapshot(data)
    if (this.assetsUrl) {
      manifest.entities = await this._localizeEntityProps(manifest.entities, {
        existingManifest: this.manifest.data,
      })
    }
    this._writeWorldFile(manifest)
  }

  async _localizeEntityProps(entities, { existingManifest } = {}) {
    if (!Array.isArray(entities) || entities.length === 0) return entities
    const existingById = new Map()
    if (Array.isArray(existingManifest?.entities)) {
      for (const entity of existingManifest.entities) {
        if (entity?.id) existingById.set(entity.id, entity)
      }
    }
    const localized = []
    for (const entity of entities) {
      if (!entity || typeof entity !== 'object') {
        localized.push(entity)
        continue
      }
      const props =
        entity.props && typeof entity.props === 'object' && !Array.isArray(entity.props) ? entity.props : null
      if (!props) {
        localized.push(entity)
        continue
      }
      const existingEntity = existingById.get(entity.id)
      const existingProps =
        existingEntity?.props && typeof existingEntity.props === 'object' && !Array.isArray(existingEntity.props)
          ? existingEntity.props
          : null
      const parsed = parseBlueprintId(entity.blueprint || '')
      const appName = parsed?.appName || 'app'
      const nextProps = {}
      for (const [key, value] of Object.entries(props)) {
        if (value && typeof value === 'object' && typeof value.url === 'string') {
          const ext = path.extname(value.url) || ''
          const suggested = buildSuggestedAssetFilename(value.name || key, { fallbackBase: key, ext })
          const existingUrl =
            existingProps?.[key] && typeof existingProps[key] === 'object' ? existingProps[key].url : null
          const url = await this._maybeDownloadAsset(appName, value.url, suggested, { existingUrl })
          nextProps[key] = { ...value, url }
        } else {
          nextProps[key] = value
        }
      }
      localized.push({ ...entity, props: nextProps })
    }
    return localized
  }

  async _onWorldFileChanged() {
    try {
      const manifest = this.manifest.read()
      if (!manifest) return
      const errors = this.manifest.validate(manifest)
      if (errors.length) {
        console.error(`❌ Invalid world.json:\n- ${errors.join('\n- ')}`)
        return
      }
      await this._deployAllBlueprints()
      await this._applyManifestToWorld(manifest)
    } catch (err) {
      console.error('❌ Failed to apply world.json:', err?.message || err)
    }
  }

  _scheduleDeployApp(appName) {
    const key = `app:${appName}`
    if (this.deployTimers.has(key)) clearTimeout(this.deployTimers.get(key))
    const timer = setTimeout(() => {
      this.deployTimers.delete(key)
      this._deployBlueprintsForApp(appName).catch(err => {
        console.error(`❌ Deploy failed for ${appName}:`, err?.message || err)
      })
    }, 750)
    this.deployTimers.set(key, timer)
  }

  _scheduleDeployBlueprint(id) {
    const key = `bp:${id}`
    if (this.deployTimers.has(key)) clearTimeout(this.deployTimers.get(key))
    const timer = setTimeout(() => {
      this.deployTimers.delete(key)
      this._deployBlueprintById(id).catch(err => {
        console.error(`❌ Deploy failed for ${id}:`, err?.message || err)
      })
    }, 750)
    this.deployTimers.set(key, timer)
  }

  _getDeployLockOwner(appName = null) {
    const target = process.env.HYPERFY_TARGET || 'default'
    const label = appName ? `:${appName}` : ''
    return `app-server${label}:${target}:${process.pid}`
  }

  async _acquireDeployLock({ owner, scope } = {}) {
    const lockOwner = owner || this._getDeployLockOwner()
    const result = await this.client.acquireDeployLock({ owner: lockOwner, scope })
    return { token: result.token, scope }
  }

  async _releaseDeployLock({ token, scope } = {}) {
    if (!token) return
    await this.client.releaseDeployLock({ token, scope })
  }

  async _withDeployLock(fn, { owner, scope } = {}) {
    const lock = await this._acquireDeployLock({ owner, scope })
    try {
      return await fn(lock)
    } finally {
      await this._releaseDeployLock(lock)
    }
  }

  _getDeployTargetName() {
    return process.env.HYPERFY_TARGET || null
  }

  _resolveScriptRootsByScope(appName, infos, index = null) {
    const candidates = index ? Array.from(index.values()).filter(item => item.appName === appName) : infos
    if (!candidates || !candidates.length) {
      return {
        fallbackRootId: null,
        byScope: new Map(),
      }
    }
    const grouped = new Map()
    for (const info of candidates) {
      const cfg = readJson(info.configPath)
      const current = this.snapshot?.blueprints?.get(info.id) || null
      const scope = this._resolveBlueprintPayloadScope(info, cfg, current)
      if (!scope) continue
      if (!grouped.has(scope)) grouped.set(scope, [])
      grouped.get(scope).push(info)
    }
    const byScope = new Map()
    for (const [scope, items] of grouped.entries()) {
      const sorted = items.slice().sort(compareBlueprintsForMain)
      const rootId = sorted[0]?.id || items[0]?.id || null
      if (rootId) byScope.set(scope, rootId)
    }
    const sorted = candidates.slice().sort(compareBlueprintsForMain)
    const fallbackRootId = sorted[0]?.id || candidates[0]?.id || null
    return { fallbackRootId, byScope }
  }

  _assignScriptRootsForApp(appName, infos, scriptInfo, index = null) {
    if (!scriptInfo || scriptInfo.mode !== 'module') return scriptInfo
    const roots = this._resolveScriptRootsByScope(appName, infos, index)
    scriptInfo.scriptRootId = roots.fallbackRootId
    scriptInfo.scriptRootIdsByScope = roots.byScope
    return scriptInfo
  }

  _resolveScriptRootIdForBlueprint(info, cfg, current, scriptInfo) {
    const scopedRoots = scriptInfo?.scriptRootIdsByScope
    if (scopedRoots && typeof scopedRoots.get === 'function') {
      const scope = this._resolveBlueprintPayloadScope(info, cfg, current)
      if (scope) {
        const scopedRootId = scopedRoots.get(scope)
        if (scopedRootId) return scopedRootId
      }
    }
    return scriptInfo?.scriptRootId || info.appName || info.id || null
  }

  _buildScriptPayload(info, cfg, current, scriptInfo) {
    if (!scriptInfo || scriptInfo.mode !== 'module') return {}
    const payload = {}
    const rootId = this._resolveScriptRootIdForBlueprint(info, cfg, current, scriptInfo)
    if (!rootId || info.id === rootId) {
      payload.scriptEntry = scriptInfo.scriptEntry
      payload.scriptFiles = scriptInfo.scriptFiles
      payload.scriptFormat = scriptInfo.scriptFormat
      payload.scriptRef = null
      return payload
    }
    payload.scriptRef = rootId
    // Variants reference shared script metadata from scriptRef root and should
    // not carry their own stale script module fields.
    payload.scriptEntry = null
    payload.scriptFiles = null
    payload.scriptFormat = null
    return payload
  }

  _isMissingScriptError(err) {
    const message = err?.message || ''
    return message.startsWith('missing_script_entry:') || message.startsWith('missing_script_files:')
  }

  async _safeUploadScriptForApp(appName, scriptPath = null, { upload = true, allowMissing = false } = {}) {
    try {
      return await this._uploadScriptForApp(appName, scriptPath, { upload })
    } catch (err) {
      if (allowMissing && this._isMissingScriptError(err)) {
        return null
      }
      throw err
    }
  }

  _resolveBlueprintPayloadScript(info, cfg, current, scriptInfo) {
    if (scriptInfo && scriptInfo.mode === 'module') {
      return {
        script: scriptInfo.scriptUrl,
        ...this._buildScriptPayload(info, cfg, current, scriptInfo),
      }
    }

    const scriptRef = normalizeSyncString(cfg?.scriptRef) || normalizeSyncString(current?.scriptRef)
    const script = normalizeSyncString(cfg?.script) ?? normalizeSyncString(current?.script) ?? ''
    const payload = { script }
    if (scriptRef) {
      payload.scriptRef = scriptRef
      payload.scriptEntry = null
      payload.scriptFiles = null
      payload.scriptFormat = null
      return payload
    }
    const scriptEntry = normalizeSyncString(current?.scriptEntry)
    const scriptFiles =
      current?.scriptFiles && typeof current.scriptFiles === 'object' && !Array.isArray(current.scriptFiles)
        ? current.scriptFiles
        : null
    const scriptFormat = normalizeScriptFormat(cfg?.scriptFormat) || normalizeScriptFormat(current?.scriptFormat)
    if (scriptEntry) payload.scriptEntry = scriptEntry
    if (scriptFiles) payload.scriptFiles = scriptFiles
    if (scriptFormat) payload.scriptFormat = scriptFormat
    return payload
  }

  async _prepareBlueprintPayload(info, scriptInfo, { uploadAssets = true } = {}) {
    const cfg = readJson(info.configPath)
    if (!cfg || typeof cfg !== 'object') {
      throw new Error(`invalid_blueprint_config:${info.configPath}`)
    }
    const current = this.snapshot?.blueprints?.get(info.id) || null
    const scriptPayload = this._resolveBlueprintPayloadScript(info, cfg, current, scriptInfo)
    const payload = {
      id: info.id,
      name: this._resolveBlueprintPayloadName(info, cfg, current),
      ...scriptPayload,
      ...pickBlueprintFields(cfg),
    }
    const resolvedScope = this._resolveBlueprintPayloadScope(info, cfg, current)
    if (resolvedScope) {
      payload.scope = resolvedScope
    }
    if (typeof cfg.createdAt === 'string' && cfg.createdAt.trim()) {
      payload.createdAt = cfg.createdAt.trim()
    }
    return this._resolveLocalBlueprintToAssetUrls(payload, { upload: uploadAssets, current })
  }

  _resolveBlueprintPayloadName(info, cfg, current = null) {
    const configuredName = normalizeSyncString(cfg?.name)
    const currentName = normalizeSyncString(current?.name)
    return configuredName || currentName || info.fileBase
  }

  _resolveBlueprintPayloadScope(info, cfg, current = null) {
    const configuredScope = normalizeScopeValue(cfg?.scope)
    const currentScope = getBlueprintScopeValue(current)
    const fallbackScope =
      normalizeScopeValue(info?.appName) || (info?.id === '$scene' ? '$scene' : normalizeScopeValue(info?.id))
    return configuredScope || currentScope || fallbackScope
  }

  async _buildDeployPlan(appName, infos, { uploadAssets = false, uploadScripts = false, index = null } = {}) {
    const scriptInfo = await this._safeUploadScriptForApp(appName, infos[0].scriptPath, {
      upload: uploadScripts,
      allowMissing: true,
    })
    if (scriptInfo?.mode === 'module') {
      this._assignScriptRootsForApp(appName, infos, scriptInfo, index)
    }
    const changes = []
    for (const info of infos) {
      const desired = await this._prepareBlueprintPayload(info, scriptInfo, { uploadAssets })
      const current = this.snapshot?.blueprints?.get(info.id) || null
      if (!current) {
        changes.push({ info, desired, current: null, type: 'add', scriptChanged: true, otherChanged: true })
        continue
      }
      const desiredCompare = normalizeBlueprintForCompare(desired)
      const currentCompare = normalizeBlueprintForCompare(current)
      if (isEqual(desiredCompare, currentCompare)) {
        changes.push({ info, desired, current, type: 'unchanged', scriptChanged: false, otherChanged: false })
        continue
      }
      const desiredScript = normalizeBlueprintScriptFields(desired)
      const currentScript = normalizeBlueprintScriptFields(current)
      const scriptChanged = !isEqual(desiredScript, currentScript)
      const desiredNoScript = normalizeBlueprintForCompareWithoutScript(desired)
      const currentNoScript = normalizeBlueprintForCompareWithoutScript(current)
      const otherChanged = !isEqual(desiredNoScript, currentNoScript)
      changes.push({ info, desired, current, type: 'update', scriptChanged, otherChanged })
    }
    return { scriptInfo, changes }
  }

  _summarizeDeployPlan(plan) {
    const adds = plan.changes.filter(item => item.type === 'add')
    const updates = plan.changes.filter(item => item.type === 'update')
    const unchanged = plan.changes.filter(item => item.type === 'unchanged')
    const scriptChanges = updates.filter(item => item.scriptChanged).length
    const configChanges = updates.filter(item => item.otherChanged).length
    return {
      adds,
      updates,
      unchanged,
      scriptChanges,
      configChanges,
      totalChanges: adds.length + updates.length,
    }
  }

  _printDeployPlan(appName, summary) {
    const addNames = summary.adds.map(item => item.info?.fileBase || item.desired?.name || item.info?.id)
    const updateNames = summary.updates.map(item => item.info?.fileBase || item.desired?.name || item.info?.id)
    const unchangedCount = summary.unchanged.length
    console.log(`📦 Deploy plan for ${appName}:`)
    if (!summary.totalChanges) {
      console.log('  • no changes')
      return
    }
    if (summary.adds.length) {
      console.log(`  • add: ${summary.adds.length}${addNames.length ? ` (${formatNameList(addNames)})` : ''}`)
    }
    if (summary.updates.length) {
      const details = []
      if (summary.scriptChanges) details.push(`script: ${summary.scriptChanges}`)
      if (summary.configChanges) details.push(`config: ${summary.configChanges}`)
      const detailText = details.length ? ` [${details.join(', ')}]` : ''
      console.log(
        `  • update: ${summary.updates.length}${detailText}${updateNames.length ? ` (${formatNameList(updateNames)})` : ''}`
      )
    }
    if (unchangedCount) {
      console.log(`  • unchanged: ${unchangedCount}`)
    }
  }

  async _createDeploySnapshot(blueprintIds, { note, lockToken, scope } = {}) {
    if (!blueprintIds.length) return null
    const target = this._getDeployTargetName()
    return this.client.createDeploySnapshot({
      ids: blueprintIds,
      target,
      note,
      lockToken,
      scope,
    })
  }

  async _deployAllBlueprints() {
    this._logTarget()
    const index = this._indexLocalBlueprints()
    const byApp = new Map()
    for (const info of index.values()) {
      if (!byApp.has(info.appName)) byApp.set(info.appName, [])
      byApp.get(info.appName).push(info)
    }
    for (const [appName, infos] of byApp.entries()) {
      await this._deployBlueprintsForApp(appName, infos, index)
    }
  }

  async _deployBlueprintById(id) {
    const index = this._indexLocalBlueprints()
    const info = index.get(id)
    if (!info) return
    await this._deployBlueprintsForApp(info.appName, [info], index)
  }

  async _deployBlueprintsForApp(appName, infos = null, index = null, options = {}) {
    const prior = this.deployQueues.get(appName) || Promise.resolve()
    const run = prior.catch(() => {}).then(() => this._deployBlueprintsForAppInternal(appName, infos, index, options))
    let chained = run
    chained = run.finally(() => {
      if (this.deployQueues.get(appName) === chained) {
        this.deployQueues.delete(appName)
      }
    })
    this.deployQueues.set(appName, chained)
    return chained
  }

  async _deployBlueprintsForAppInternal(appName, infos = null, index = null, options = {}) {
    this._logTarget()
    const blueprintIndex = index || this._indexLocalBlueprints()
    const list = infos || Array.from(blueprintIndex.values()).filter(item => item.appName === appName)
    if (!list.length) return

    const preview = !!options.preview || !!options.dryRun
    const note = typeof options.note === 'string' && options.note.trim() ? options.note.trim() : null
    const plan = await this._buildDeployPlan(appName, list, { index: blueprintIndex })
    const summary = this._summarizeDeployPlan(plan)
    if (preview) {
      this._printDeployPlan(appName, summary)
    }
    if (!summary.totalChanges) return
    if (options.dryRun) return

    const snapshotItems = [...summary.adds, ...summary.updates]
    const snapshotIds = snapshotItems.map(item => item.info?.id).filter(Boolean)
    const snapshotNote = note || process.env.DEPLOY_NOTE || null
    const snapshotScopeSet = new Set()
    for (const item of snapshotItems) {
      const id = item.info?.id || item.desired?.id || item.current?.id || 'unknown'
      if (item.current) {
        const currentScope = getBlueprintScopeValue(item.current)
        if (!currentScope) {
          throw new Error(`missing_blueprint_scope:${id}`)
        }
        snapshotScopeSet.add(currentScope)
        continue
      }
      const desiredScope = getBlueprintScopeValue(item.desired)
      if (!desiredScope) {
        throw new Error(`missing_blueprint_scope:${id}`)
      }
      snapshotScopeSet.add(desiredScope)
    }

    let deployScope = 'global'
    if (snapshotScopeSet.size === 1) {
      deployScope = snapshotScopeSet.values().next().value || 'global'
    } else if (snapshotScopeSet.size > 1) {
      const scopes = Array.from(snapshotScopeSet.values())
      console.warn(
        `⚠️  Deploy for ${appName} spans multiple blueprint scopes (${formatNameList(scopes)}); using a global deploy lock.`
      )
    }

    await this._withDeployLock(
      async lock => {
        await this._createDeploySnapshot(snapshotIds, { note: snapshotNote, lockToken: lock.token, scope: lock.scope })
        const scriptInfo = await this._safeUploadScriptForApp(appName, list[0].scriptPath, {
          allowMissing: true,
        })
        if (scriptInfo?.mode === 'module') {
          this._assignScriptRootsForApp(appName, list, scriptInfo, blueprintIndex)
        }
        for (const info of list) {
          await this._deployBlueprint(info, scriptInfo, { lockToken: lock.token })
        }
      },
      { owner: this._getDeployLockOwner(appName), scope: deployScope }
    )
  }

  async _uploadScriptForApp(appName, scriptPath = null, { upload = true } = {}) {
    const modeInfo = this._resolveAppScriptMode(appName)
    return this._uploadScriptFilesForApp(appName, modeInfo, { upload })
  }

  async _uploadScriptFilesForApp(appName, modeInfo, { upload = true } = {}) {
    const appPath = modeInfo?.appPath || path.join(this.appsDir, appName)
    const entryPath = modeInfo?.entryPath || this._getScriptPath(appName)
    if (!entryPath || !fs.existsSync(entryPath)) {
      throw new Error(`missing_script_entry:${appName}`)
    }

    const files = Array.isArray(modeInfo?.files) && modeInfo.files.length ? modeInfo.files : listScriptFiles(appPath)
    if (!files.length) {
      throw new Error(`missing_script_files:${appName}`)
    }
    const sharedRelPaths = modeInfo?.sharedRelPaths
    if (sharedRelPaths && sharedRelPaths.size) {
      const fileRelPaths = new Set(files.map(file => normalizeScriptRelPath(file.relPath)))
      const missing = []
      for (const relPath of sharedRelPaths) {
        if (!fileRelPaths.has(relPath)) {
          missing.push(relPath)
        }
      }
      if (missing.length) {
        throw new Error(`missing_shared_scripts:${formatNameList(missing)}`)
      }
    }

    const scriptEntry = normalizeScriptRelPath(path.relative(appPath, entryPath))
    const scriptFiles = {}
    let entryText = null
    let entryHash = null
    let entryUrl = null

    for (const file of files) {
      const relPath = normalizeScriptRelPath(file.relPath)
      const buffer = fs.readFileSync(file.absPath)
      const hash = sha256(buffer)
      const ext = path.extname(file.absPath) || '.js'
      const filename = `${hash}${ext}`
      if (upload) {
        await this.client.uploadAsset({
          filename,
          buffer,
          mimeType: 'text/javascript',
        })
      }
      const assetUrl = `asset://${filename}`
      scriptFiles[relPath] = assetUrl
      if (relPath === scriptEntry) {
        entryText = buffer.toString('utf8')
        entryHash = hash
        entryUrl = assetUrl
      }
    }

    if (!entryUrl) {
      throw new Error(`missing_script_entry:${appName}`)
    }

    const detectedFormat = entryHasDefaultExport(entryText) ? 'module' : 'legacy-body'
    const configuredFormat = normalizeScriptFormat(modeInfo?.scriptFormat)
    const scriptFormat = detectedFormat

    if (configuredFormat && configuredFormat !== detectedFormat) {
      const warnKey = `${appName}:mismatch:${configuredFormat}:${detectedFormat}`
      if (!this.scriptFormatWarnings.has(warnKey)) {
        this.scriptFormatWarnings.add(warnKey)
        console.warn(
          `⚠️  scriptFormat mismatch for ${appName}; ` +
            `entry script resolves to "${detectedFormat}" but blueprint config is "${configuredFormat}". ` +
            `Using "${detectedFormat}" and syncing local blueprint files.`
        )
      }
    } else if (!configuredFormat) {
      const warnKey = `${appName}:missing:${detectedFormat}`
      if (!this.scriptFormatWarnings.has(warnKey)) {
        this.scriptFormatWarnings.add(warnKey)
        console.warn(
          `⚠️  Missing scriptFormat for ${appName}; ` +
            `detected "${detectedFormat}" from entry script and syncing local blueprint files.`
        )
      }
    }

    const syncedFormats = this._syncScriptFormatForApp(appName, detectedFormat)
    if (syncedFormats > 0) {
      console.log(
        `📝 Updated scriptFormat to "${detectedFormat}" in ${syncedFormats} blueprint file(s) for ${appName}.`
      )
    }
    return {
      mode: 'module',
      scriptUrl: entryUrl,
      scriptEntry,
      scriptFiles,
      scriptFormat,
      scriptPath: entryPath,
      scriptText: entryText,
      scriptHash: entryHash,
    }
  }

  async _deployBlueprint(info, scriptInfo, { lockToken } = {}) {
    const cfg = readJson(info.configPath)
    if (!cfg || typeof cfg !== 'object') {
      console.error(`❌ Invalid blueprint config: ${info.configPath}`)
      return
    }
    let current = this.snapshot?.blueprints?.get(info.id) || null

    const scriptPayload = this._resolveBlueprintPayloadScript(info, cfg, current, scriptInfo)
    const payload = {
      id: info.id,
      name: this._resolveBlueprintPayloadName(info, cfg, current),
      ...scriptPayload,
      ...pickBlueprintFields(cfg),
    }
    const resolvedScope = this._resolveBlueprintPayloadScope(info, cfg, current)
    if (resolvedScope) {
      payload.scope = resolvedScope
    }
    if (typeof cfg.createdAt === 'string' && cfg.createdAt.trim()) {
      payload.createdAt = cfg.createdAt.trim()
    }

    const resolved = await this._resolveLocalBlueprintToAssetUrls(payload, { current })

    if (!current) {
      resolved.version = 0
      await this.client.request('blueprint_add', { blueprint: resolved, lockToken })
    } else {
      const resolvedScope = getBlueprintScopeValue(resolved)
      const currentScope = getBlueprintScopeValue(current)
      if (resolvedScope && currentScope && resolvedScope !== currentScope) {
        await this._modifyBlueprintWithVersionRetry(
          {
            id: info.id,
            scope: resolvedScope,
          },
          current,
          { lockToken }
        )
        const scoped = await this.client.getBlueprint(info.id)
        if (scoped?.id) {
          current = scoped
        }
      }
      const nextCompare = normalizeBlueprintForCompare(resolved)
      const currentCompare = normalizeBlueprintForCompare(current)
      if (isEqual(nextCompare, currentCompare)) return
      await this._modifyBlueprintWithVersionRetry(resolved, current, { lockToken })
    }

    const updated = await this.client.getBlueprint(info.id)
    if (updated?.id) {
      this.snapshot.blueprints.set(updated.id, updated)
      this._refreshSyncState()
    }
  }

  async _modifyBlueprintWithVersionRetry(change, currentBlueprint, { lockToken } = {}) {
    const payload = change && typeof change === 'object' ? { ...change } : {}
    const id = normalizeSyncString(payload.id)
    if (!id) {
      throw new Error('invalid_blueprint_id')
    }
    const attempt = async version => {
      payload.version = version
      await this.client.request('blueprint_modify', { change: payload, lockToken })
    }
    try {
      await attempt((currentBlueprint?.version || 0) + 1)
    } catch (err) {
      if (err?.code !== 'version_mismatch') throw err
      const latest = err.current || (await this.client.getBlueprint(id))
      await attempt((latest?.version || 0) + 1)
    }
  }

  async _resolveLocalBlueprintToAssetUrls(cfg, { upload = true, current = null } = {}) {
    const out = { ...cfg }

    if (typeof out.model === 'string') {
      out.model = await this._resolveLocalAssetToWorldUrl(out.model, {
        upload,
        existingUrl: typeof current?.model === 'string' ? current.model : null,
      })
    }

    if (out.image && typeof out.image === 'object' && typeof out.image.url === 'string') {
      out.image = {
        ...out.image,
        url: await this._resolveLocalAssetToWorldUrl(out.image.url, {
          upload,
          existingUrl: getExistingAssetUrl(current?.image),
        }),
      }
    }

    if (out.props && typeof out.props === 'object') {
      const nextProps = {}
      const existingProps =
        current?.props && typeof current.props === 'object' && !Array.isArray(current.props) ? current.props : {}
      for (const [k, v] of Object.entries(out.props)) {
        if (v && typeof v === 'object' && typeof v.url === 'string') {
          const existingValue = existingProps[k]
          nextProps[k] = {
            ...v,
            url: await this._resolveLocalAssetToWorldUrl(v.url, {
              upload,
              existingUrl: getExistingAssetUrl(existingValue),
            }),
          }
        } else {
          nextProps[k] = v
        }
      }
      out.props = nextProps
    }

    return out
  }

  async _resolveLocalEntityPropsToAssetUrls(props, { upload = true, currentProps = null } = {}) {
    if (!props || typeof props !== 'object' || Array.isArray(props)) return {}
    const nextProps = {}
    const existingProps =
      currentProps && typeof currentProps === 'object' && !Array.isArray(currentProps) ? currentProps : {}
    for (const [key, value] of Object.entries(props)) {
      if (value && typeof value === 'object' && typeof value.url === 'string') {
        const existingValue = existingProps[key]
        nextProps[key] = {
          ...value,
          url: await this._resolveLocalAssetToWorldUrl(value.url, {
            upload,
            existingUrl: getExistingAssetUrl(existingValue),
          }),
        }
      } else {
        nextProps[key] = value
      }
    }
    return nextProps
  }

  async _resolveLocalAssetToWorldUrl(url, { upload = true, existingUrl = null } = {}) {
    if (typeof url !== 'string') return url
    const normalized = normalizeAssetPath(url)
    if (normalized.startsWith('asset://')) return normalized
    if (!normalized.startsWith('assets/')) return normalized

    const abs = path.join(this.rootDir, normalized)
    if (!fs.existsSync(abs)) return normalized
    const buffer = fs.readFileSync(abs)
    const hash = sha256(buffer)
    const ext = path.extname(normalized).toLowerCase().replace(/^\./, '') || 'bin'
    const normalizedExisting = typeof existingUrl === 'string' ? normalizeAssetPath(existingUrl) : null
    if (!upload && normalizedExisting && normalizedExisting.startsWith('asset://')) {
      const existingFilename = extractAssetFilename(normalizedExisting)
      const existingExtWithDot = existingFilename ? path.extname(existingFilename).toLowerCase() : ''
      const existingExt = existingExtWithDot.replace(/^\./, '')
      if (!existingExt || existingExt === ext) {
        if (existingFilename && isHashedAssetFilename(existingFilename)) {
          const expectedHash = existingFilename.slice(0, -existingExtWithDot.length).toLowerCase()
          if (expectedHash === hash) {
            return normalizedExisting
          }
        } else {
          return normalizedExisting
        }
      }
    }
    const filename = `${hash}.${ext}`
    if (upload) {
      await this.client.uploadAsset({ filename, buffer })
    }
    return `asset://${filename}`
  }

  async _applyManifestToWorld(manifest) {
    if (!this.snapshot) return
    this._logTarget()

    for (const [key, value] of Object.entries(manifest.settings || {})) {
      if (!isEqual(this.snapshot.settings?.[key], value)) {
        await this.client.request('settings_modify', { key, value })
        this.snapshot.settings[key] = value
      }
    }

    const spawnChanged =
      !isEqual(this.snapshot.spawn?.position, manifest.spawn?.position) ||
      !isEqual(this.snapshot.spawn?.quaternion, manifest.spawn?.quaternion)

    if (spawnChanged) {
      await this.client.setSpawn({
        position: manifest.spawn.position,
        quaternion: manifest.spawn.quaternion,
      })
      this.snapshot.spawn = {
        position: manifest.spawn.position.slice(0, 3),
        quaternion: manifest.spawn.quaternion.slice(0, 4),
      }
    }

    const desired = new Map()
    for (const entity of manifest.entities || []) {
      desired.set(entity.id, entity)
    }
    const current = new Map()
    for (const entity of this.snapshot.entities.values()) {
      if (entity?.type === 'app') current.set(entity.id, entity)
    }

    for (const [id, entity] of desired.entries()) {
      const existing = current.get(id)
      const desiredProps =
        entity.props && typeof entity.props === 'object' && !Array.isArray(entity.props) ? entity.props : {}
      const resolvedProps = await this._resolveLocalEntityPropsToAssetUrls(desiredProps, {
        currentProps: existing?.props,
      })
      if (!existing) {
        const data = {
          id: entity.id,
          type: 'app',
          blueprint: entity.blueprint,
          position: entity.position,
          quaternion: entity.quaternion,
          scale: entity.scale,
          mover: null,
          uploader: null,
          pinned: entity.pinned,
          props: resolvedProps,
          state: entity.state,
        }
        await this.client.request('entity_add', { entity: data })
        this.snapshot.entities.set(id, { ...data })
        continue
      }

      const change = { id }
      if (!isEqual(existing.blueprint, entity.blueprint)) change.blueprint = entity.blueprint
      if (!isEqual(existing.position, entity.position)) change.position = entity.position
      if (!isEqual(existing.quaternion, entity.quaternion)) change.quaternion = entity.quaternion
      if (!isEqual(existing.scale, entity.scale)) change.scale = entity.scale
      if (!isEqual(existing.pinned, entity.pinned)) change.pinned = entity.pinned
      const existingProps =
        existing.props && typeof existing.props === 'object' && !Array.isArray(existing.props) ? existing.props : {}
      if (!isEqual(existingProps, resolvedProps)) change.props = resolvedProps
      if (!isEqual(existing.state, entity.state)) change.state = entity.state

      if (Object.keys(change).length > 1) {
        await this.client.request('entity_modify', { change })
        this.snapshot.entities.set(id, { ...existing, ...change })
      }
    }

    for (const [id] of current.entries()) {
      if (!desired.has(id)) {
        await this.client.request('entity_remove', { id })
        this.snapshot.entities.delete(id)
      }
    }

    this._refreshSyncState()
  }

  _attachRemoteHandlers() {
    this.client.on('message', async msg => {
      if (!msg || typeof msg !== 'object') return
      if (msg.type === 'blueprintAdded' && msg.blueprint?.id) {
        await this._onRemoteBlueprint(msg.blueprint)
      }
      if (msg.type === 'blueprintModified' && msg.blueprint?.id) {
        await this._onRemoteBlueprint(msg.blueprint)
      }
      if (msg.type === 'blueprintRemoved' && msg.id) {
        await this._onRemoteBlueprintRemoved(msg.id)
      }
      if (msg.type === 'entityAdded' && msg.entity?.id) {
        this.snapshot.entities.set(msg.entity.id, msg.entity)
        this._refreshSyncState()
        this._scheduleManifestWrite()
      }
      if (msg.type === 'entityModified' && msg.entity?.id) {
        const existing = this.snapshot.entities.get(msg.entity.id)
        this.snapshot.entities.set(msg.entity.id, { ...existing, ...msg.entity })
        this._refreshSyncState()
        this._scheduleManifestWrite()
      }
      if (msg.type === 'entityRemoved' && msg.id) {
        this.snapshot.entities.delete(msg.id)
        this._refreshSyncState()
        this._scheduleManifestWrite()
      }
      if (msg.type === 'settingsModified' && msg.data?.key) {
        this.snapshot.settings[msg.data.key] = msg.data.value
        this._scheduleManifestWrite()
      }
      if (msg.type === 'spawnModified' && msg.spawn) {
        this.snapshot.spawn = {
          position: Array.isArray(msg.spawn.position) ? msg.spawn.position.slice(0, 3) : [0, 0, 0],
          quaternion: Array.isArray(msg.spawn.quaternion) ? msg.spawn.quaternion.slice(0, 4) : [0, 0, 0, 1],
        }
        this._scheduleManifestWrite()
      }
    })
  }

  async _onRemoteBlueprint(blueprint) {
    this.snapshot.blueprints.set(blueprint.id, blueprint)
    this._refreshSyncState()
    const result = await this._writeBlueprintToDisk({
      blueprint,
      force: true,
      includeBuiltScripts: true,
      includeScriptSources: true,
      pruneScriptSources: true,
    })
    const appName = result?.appName || parseBlueprintId(blueprint.id).appName
    this._watchAppDir(appName)
  }

  async _onRemoteBlueprintRemoved(id) {
    const localIndex = this._indexLocalBlueprints()
    const projection = this._resolveBlueprintProjection(id, { localIndex })
    const info = projection.info || localIndex.get(id) || null
    const configPath = projection.configPath
    const existingConfig = readJson(configPath)
    const keep = info?.keep === true || existingConfig?.keep === true
    this.snapshot.blueprints.delete(id)
    this._refreshSyncState()
    if (keep) return
    this._removeLocalBlueprintFromDisk(id, { localIndex })
  }

  _maybeRemoveEmptyAppFolder(appName) {
    const appPath = path.join(this.appsDir, appName)
    if (!fs.existsSync(appPath)) return
    let entries = []
    try {
      entries = fs.readdirSync(appPath, { withFileTypes: true })
    } catch {
      return
    }
    const hasBlueprint = entries.some(entry => {
      if (!entry.isFile()) return false
      if (!entry.name.endsWith('.json')) return false
      return !isBlueprintDenylist(entry.name)
    })
    if (hasBlueprint) return
    this._closeWatchersUnderDir(appPath)
    try {
      fs.rmSync(appPath, { recursive: true, force: true })
    } catch (err) {
      console.warn(`⚠️  Failed to delete app folder: ${appPath}`)
    }
  }

  async _writeBlueprintToDisk({
    blueprint,
    force,
    includeBuiltScripts = false,
    includeScriptSources = true,
    allowScriptOverwrite = false,
    pruneScriptSources = false,
    scriptRoot = null,
    localIndex = null,
    scriptGroups = null,
  }) {
    const index = localIndex || this._indexLocalBlueprints()
    const existingInfo = blueprint?.id ? index.get(blueprint.id) : null
    const scriptKey = getScriptKey(blueprint)
    const groups =
      scriptGroups || (this.snapshot?.blueprints ? buildScriptGroupIndex(this.snapshot.blueprints) : new Map())
    let appName = existingInfo?.appName || null
    if (!appName && scriptKey && groups.size) {
      const group = groups.get(scriptKey)
      const main = group?.main || null
      if (main?.id) {
        const mainInfo = index.get(main.id)
        appName = mainInfo?.appName || parseBlueprintId(main.id).appName
      }
    }
    if (!appName) {
      appName = parseBlueprintId(blueprint.id).appName
    }
    const appPath = path.join(this.appsDir, appName)
    ensureDir(appPath)

    let fileBase = existingInfo?.fileBase || parseBlueprintId(blueprint.id).fileBase || blueprint.id
    fileBase = sanitizeFileBaseName(fileBase)
    const blueprintPath = path.join(
      appPath,
      `${resolveUniqueFileBase(appPath, fileBase, blueprint.id, existingInfo?.configPath)}.json`
    )
    const existingConfigPath = existingInfo?.configPath
    const existingConfig = existingConfigPath ? readJson(existingConfigPath) : readJson(blueprintPath)
    const localBlueprint = await this._blueprintToLocalConfig(appName, blueprint, { existingConfig })
    const destinationConfig = readJson(blueprintPath)
    if (force || !fs.existsSync(blueprintPath)) {
      this._writeFileAtomic(blueprintPath, JSON.stringify(localBlueprint, null, 2) + '\n')
    } else {
      if (!isEqual(destinationConfig, localBlueprint)) {
        this._writeFileAtomic(blueprintPath, JSON.stringify(localBlueprint, null, 2) + '\n')
      }
    }
    if (existingConfigPath && existingConfigPath !== blueprintPath) {
      this._deleteFileAtomic(existingConfigPath)
      if (existingInfo?.appName && existingInfo.appName !== appName) {
        this._maybeRemoveEmptyAppFolder(existingInfo.appName)
      }
    }
    const relativeConfigPath = toProjectRelativePath(this.rootDir, blueprintPath)
    const identitySignature = buildBlueprintIdentitySignature(localBlueprint)
    const nextInfo = {
      id: blueprint.id,
      uid:
        normalizeSyncString(blueprint?.uid) ||
        normalizeSyncString(localBlueprint?.uid) ||
        normalizeSyncString(existingInfo?.uid) ||
        normalizeSyncString(existingConfig?.uid) ||
        null,
      appName,
      fileBase: path.basename(blueprintPath, '.json'),
      configPath: blueprintPath,
      relativeConfigPath,
      scriptPath: this._getScriptPath(appName),
      createdAt: typeof blueprint.createdAt === 'string' ? blueprint.createdAt : existingInfo?.createdAt || null,
      scriptKey: scriptKey || '',
      keep: blueprint.keep === true,
      identitySignature,
    }
    if (index) index.set(blueprint.id, nextInfo)
    this.localBlueprintPathIndex.set(blueprintPath, nextInfo)
    if (existingConfigPath && existingConfigPath !== blueprintPath) {
      this.localBlueprintPathIndex.delete(existingConfigPath)
    }
    this._syncBlueprintIdentityIndex(index)

    const resolvedScriptRoot = scriptRoot || this._resolveRemoteScriptRootBlueprint(blueprint)
    if (resolvedScriptRoot) {
      if (includeScriptSources) {
        await this._syncScriptSourcesToDisk(appName, resolvedScriptRoot, { pruneMissing: pruneScriptSources })
      }
      return { appName, fileBase: nextInfo.fileBase, configPath: blueprintPath }
    }

    const hasRemoteScript = typeof blueprint.script === 'string'
    if (includeBuiltScripts && hasRemoteScript) {
      const existingScriptPath = this._getScriptPath(appName)
      const scriptPath = existingScriptPath || path.join(appPath, 'index.js')
      const shouldWriteScript = allowScriptOverwrite || !existingScriptPath
      if (shouldWriteScript) {
        const script = await this._downloadScript(blueprint.script)
        if (script != null) {
          this._writeFileAtomic(scriptPath, script)
        }
      }
    }
    return { appName, fileBase: nextInfo.fileBase, configPath: blueprintPath }
  }

  async _downloadScript(scriptUrl) {
    if (!scriptUrl) return ''
    if (!scriptUrl.startsWith('asset://')) {
      return typeof scriptUrl === 'string' ? scriptUrl : ''
    }
    const filename = extractAssetFilename(scriptUrl)
    if (!filename) return ''
    const maxAttempts = 4
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const res = await fetch(joinUrl(this.assetsUrl, filename))
      if (res.ok) {
        return res.text()
      }
      if (res.status === 404 && attempt < maxAttempts - 1) {
        await sleep(250 * (attempt + 1))
        continue
      }
      if (res.status === 404) {
        console.warn(`⚠️  Script not found yet: ${filename}`)
        return null
      }
      throw new Error(`script_download_failed:${res.status}`)
    }
    return null
  }

  _resolveRemoteScriptRootBlueprint(blueprint) {
    if (!blueprint || typeof blueprint !== 'object') return null
    const scriptRef = typeof blueprint.scriptRef === 'string' ? blueprint.scriptRef.trim() : ''
    if (scriptRef) {
      const root = this.snapshot?.blueprints?.get(scriptRef)
      if (root && hasScriptFiles(root)) return root
    }
    if (hasScriptFiles(blueprint)) return blueprint
    const parsed = parseBlueprintId(blueprint.id || '')
    if (parsed.appName && parsed.appName !== blueprint.id) {
      const base = this.snapshot?.blueprints?.get(parsed.appName)
      if (base && hasScriptFiles(base)) return base
    }
    const scriptKey = getScriptKey(blueprint)
    if (scriptKey && this.snapshot?.blueprints) {
      for (const candidate of this.snapshot.blueprints.values()) {
        if (!candidate || !hasScriptFiles(candidate)) continue
        if (getScriptKey(candidate) === scriptKey) return candidate
      }
    }
    return null
  }

  async _syncScriptSourcesToDisk(appName, scriptRoot, { pruneMissing = false } = {}) {
    if (!scriptRoot || !hasScriptFiles(scriptRoot)) return false
    const appPath = path.join(this.appsDir, appName)
    ensureDir(appPath)
    const scriptFiles = scriptRoot.scriptFiles
    const keepApp = new Set()
    for (const [relPath, assetUrl] of Object.entries(scriptFiles)) {
      if (!isValidScriptPath(relPath)) {
        console.warn(`⚠️  Invalid script path in ${scriptRoot.id || appName}: ${relPath}`)
        continue
      }
      if (typeof assetUrl !== 'string' || !assetUrl.startsWith('asset://')) {
        console.warn(`⚠️  Invalid script asset in ${scriptRoot.id || appName}: ${relPath}`)
        continue
      }
      const normalized = normalizeScriptRelPath(relPath)
      const sharedRel = getSharedDiskRelativePath(normalized)
      if (!sharedRel) {
        keepApp.add(normalized)
      }
      const script = await this._downloadScript(assetUrl)
      if (script == null) continue
      const absPath = sharedRel ? path.join(this.sharedDir, sharedRel) : path.join(appPath, normalized)
      this._writeFileAtomic(absPath, script)
    }

    if (pruneMissing) {
      const localFiles = listScriptFiles(appPath)
      for (const file of localFiles) {
        const normalized = normalizeScriptRelPath(file.relPath)
        if (keepApp.has(normalized)) continue
        this._deleteFileAtomic(file.absPath)
        this._pruneEmptyDirs(appPath, path.dirname(file.absPath))
      }
    }
    return true
  }

  async _blueprintToLocalConfig(appName, blueprint, { existingConfig } = {}) {
    const output = {}
    const existing =
      existingConfig && typeof existingConfig === 'object' && !Array.isArray(existingConfig) ? existingConfig : null
    const existingCreatedAt = typeof existing?.createdAt === 'string' ? existing.createdAt : null
    const createdAt = typeof blueprint.createdAt === 'string' ? blueprint.createdAt : existingCreatedAt
    if (typeof blueprint.id === 'string' && blueprint.id) output.id = blueprint.id
    const uid = normalizeSyncString(blueprint?.uid) || normalizeSyncString(existing?.uid)
    if (uid) output.uid = uid
    const name = normalizeSyncString(blueprint?.name) || normalizeSyncString(existing?.name)
    if (name) output.name = name
    const scope = getBlueprintScopeValue(blueprint) || normalizeScopeValue(existing?.scope)
    if (scope) output.scope = scope
    const scriptKey = typeof blueprint.script === 'string' ? blueprint.script.trim() : ''
    if (scriptKey) output.script = blueprint.script
    if (createdAt) output.createdAt = createdAt
    if (blueprint.author !== undefined) output.author = blueprint.author
    if (blueprint.url !== undefined) output.url = blueprint.url
    if (blueprint.desc !== undefined) output.desc = blueprint.desc
    if (blueprint.preload !== undefined) output.preload = blueprint.preload
    if (blueprint.public !== undefined) output.public = blueprint.public
    if (blueprint.locked !== undefined) output.locked = blueprint.locked
    if (blueprint.frozen !== undefined) output.frozen = blueprint.frozen
    if (blueprint.unique !== undefined) output.unique = blueprint.unique
    if (blueprint.disabled !== undefined) output.disabled = blueprint.disabled
    if (blueprint.scene !== undefined) output.scene = blueprint.scene
    if (blueprint.keep !== undefined) {
      output.keep = blueprint.keep
    } else if (existing?.keep !== undefined) {
      output.keep = existing.keep
    }
    const scriptFormat = normalizeScriptFormat(blueprint.scriptFormat)
    if (scriptFormat) output.scriptFormat = scriptFormat
    const scriptEntry = normalizeSyncString(blueprint.scriptEntry)
    if (scriptEntry) {
      const normalizedScriptEntry = normalizeScriptRelPath(scriptEntry)
      if (isValidScriptPath(normalizedScriptEntry) && normalizedScriptEntry !== 'index.js') {
        output.scriptEntry = normalizedScriptEntry
      }
    }

    if (typeof blueprint.model === 'string') {
      const existingModel = typeof existing?.model === 'string' ? existing.model : null
      const modelExt = path.extname(blueprint.model) || '.glb'
      const modelBaseName = normalizeSyncString(blueprint?.name) || appName
      const modelSuggestedName = buildSuggestedAssetFilename(modelBaseName, { fallbackBase: appName, ext: modelExt })
      output.model = await this._maybeDownloadAsset(appName, blueprint.model, modelSuggestedName, {
        existingUrl: existingModel,
      })
    } else if (blueprint.model !== undefined) {
      output.model = blueprint.model
    }

    if (blueprint.image && typeof blueprint.image === 'object') {
      const img = { ...blueprint.image }
      if (typeof img.url === 'string') {
        const existingImageUrl = getExistingAssetUrl(existing?.image)
        const ext = path.extname(img.url) || '.png'
        img.url = await this._maybeDownloadAsset(appName, img.url, `${appName}__image${ext}`, {
          existingUrl: existingImageUrl,
        })
      }
      output.image = img
    } else if (blueprint.image === null) {
      output.image = null
    } else if (blueprint.image !== undefined) {
      output.image = blueprint.image
    }

    if (blueprint.props && typeof blueprint.props === 'object') {
      const props = {}
      const existingProps =
        existing?.props && typeof existing.props === 'object' && !Array.isArray(existing.props) ? existing.props : null
      for (const [key, value] of Object.entries(blueprint.props)) {
        if (value && typeof value === 'object' && typeof value.url === 'string') {
          const v = { ...value }
          const ext = path.extname(v.url) || ''
          const suggested = buildSuggestedAssetFilename(v.name || key, { fallbackBase: key, ext })
          const existingUrl =
            existingProps?.[key] && typeof existingProps[key] === 'object' ? existingProps[key].url : null
          v.url = await this._maybeDownloadAsset(appName, v.url, suggested, { existingUrl })
          props[key] = v
        } else {
          props[key] = value
        }
      }
      output.props = props
    } else if (blueprint.props !== undefined) {
      output.props = {}
    }

    return output
  }

  _findLocalAssetByHash(hash, { preferredExt = null } = {}) {
    const normalizedHash = normalizeSyncString(hash)?.toLowerCase()
    if (!normalizedHash) return null
    if (!fs.existsSync(this.assetsDir)) return null

    let entries = []
    try {
      entries = fs.readdirSync(this.assetsDir, { withFileTypes: true })
    } catch {
      return null
    }

    const normalizedExt = typeof preferredExt === 'string' ? preferredExt.toLowerCase() : null
    const matches = []

    for (const entry of entries) {
      if (!entry.isFile()) continue
      const filename = entry.name
      const absPath = path.join(this.assetsDir, filename)
      const ext = path.extname(filename).toLowerCase()
      const hashNamed = isHashedAssetFilename(filename)
      let fileHash = null
      if (hashNamed) {
        fileHash = filename.slice(0, -ext.length).toLowerCase()
      } else {
        try {
          fileHash = sha256(fs.readFileSync(absPath))
        } catch {
          continue
        }
      }
      if (fileHash !== normalizedHash) continue
      matches.push({
        relPath: path.posix.join('assets', filename),
        extMatches: normalizedExt ? ext === normalizedExt : false,
        hashNamed,
      })
    }

    if (!matches.length) return null
    matches.sort((a, b) => {
      if (a.extMatches !== b.extMatches) return a.extMatches ? -1 : 1
      if (a.hashNamed !== b.hashNamed) return a.hashNamed ? 1 : -1
      return a.relPath.localeCompare(b.relPath)
    })
    return matches[0].relPath
  }

  async _maybeDownloadAsset(appName, url, suggestedName, { existingUrl } = {}) {
    if (typeof url !== 'string') return url
    if (url.startsWith('assets/')) return url
    if (!url.startsWith('asset://')) return url

    const filename = extractAssetFilename(url)
    if (!filename) return url

    const ext = path.extname(filename).toLowerCase()
    const expectedHash = isHashedAssetFilename(filename) ? filename.slice(0, -ext.length).toLowerCase() : null
    const normalizedExisting = typeof existingUrl === 'string' ? normalizeAssetPath(existingUrl) : null
    if (normalizedExisting && normalizedExisting.startsWith('assets/')) {
      const existingBase = path.basename(normalizedExisting)
      const existingExt = path.extname(existingBase).toLowerCase()
      if (!existingExt || existingExt === ext) {
        suggestedName = existingBase
      }
      if (expectedHash) {
        const absExisting = path.join(this.rootDir, normalizedExisting)
        if (fs.existsSync(absExisting)) {
          const existingHash = sha256(fs.readFileSync(absExisting))
          if (existingHash === expectedHash) return normalizedExisting
        }
      }
    }
    if (expectedHash) {
      const existingByHash = this._findLocalAssetByHash(expectedHash, { preferredExt: ext })
      if (existingByHash) return existingByHash
    }

    let buffer = null
    const maxAttempts = 4
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const res = await fetch(joinUrl(this.assetsUrl, filename))
      if (res.ok) {
        buffer = Buffer.from(await res.arrayBuffer())
        break
      }
      if (res.status === 404 && attempt < maxAttempts - 1) {
        await sleep(250 * (attempt + 1))
        continue
      }
      if (res.status === 404) {
        console.warn(`⚠️  Asset not found yet: ${filename}`)
        return url
      }
      throw new Error(`asset_download_failed:${res.status}`)
    }
    if (!buffer) return url
    const hash = sha256(buffer)
    if (expectedHash && hash !== expectedHash) {
      throw new Error(`asset_hash_mismatch:${filename}`)
    }
    const existingByHash = this._findLocalAssetByHash(hash, { preferredExt: ext })
    if (existingByHash) return existingByHash

    const fallbackBase = sanitizeFileBaseName(appName || 'file')
    const normalizedSuggested = buildSuggestedAssetFilename(suggestedName, {
      fallbackBase,
      ext,
    })
    const base = ext ? normalizedSuggested.slice(0, -ext.length) : normalizedSuggested
    for (let idx = 0; idx < 10000; idx += 1) {
      const suffix = idx === 0 ? '' : `_${idx}`
      const candidate = `${base}${suffix}${ext}`
      const relPath = path.posix.join('assets', candidate)
      const absPath = path.join(this.rootDir, relPath)
      if (!fs.existsSync(absPath)) {
        this._writeFileAtomic(absPath, buffer)
        return relPath
      }
      const existingHash = sha256(fs.readFileSync(absPath))
      if (existingHash === hash) return relPath
    }
    throw new Error(`failed_to_allocate_asset_name:${base}${ext}`)
  }

  _writeFileAtomic(filePath, content) {
    this.pendingWrites.add(filePath)
    ensureDir(path.dirname(filePath))
    const tmpPath = `${filePath}.tmp-${uuid()}`
    if (Buffer.isBuffer(content)) {
      fs.writeFileSync(tmpPath, content)
    } else {
      fs.writeFileSync(tmpPath, content, 'utf8')
    }
    fs.renameSync(tmpPath, filePath)
    setTimeout(() => this.pendingWrites.delete(filePath), 500)
  }

  _deleteFileAtomic(filePath) {
    this.pendingWrites.add(filePath)
    try {
      fs.rmSync(filePath, { force: true })
    } catch {}
    setTimeout(() => this.pendingWrites.delete(filePath), 500)
  }

  _pruneEmptyDirs(rootDir, startDir) {
    let current = startDir
    while (current && current !== rootDir && current.startsWith(rootDir)) {
      let entries = []
      try {
        entries = fs.readdirSync(current)
      } catch {
        break
      }
      if (entries.length) break
      try {
        fs.rmdirSync(current)
      } catch {
        break
      }
      current = path.dirname(current)
    }
  }

  _onAssetChanged(assetRelPath) {
    const index = this._indexLocalBlueprints()
    for (const info of index.values()) {
      const cfg = readJson(info.configPath)
      if (!cfg || typeof cfg !== 'object') continue
      if (normalizeAssetPath(cfg.model) === assetRelPath) {
        this._scheduleDeployBlueprint(info.id)
        continue
      }
      if (cfg.image && typeof cfg.image === 'object' && normalizeAssetPath(cfg.image.url) === assetRelPath) {
        this._scheduleDeployBlueprint(info.id)
        continue
      }
      const props = cfg.props && typeof cfg.props === 'object' ? cfg.props : {}
      for (const value of Object.values(props)) {
        if (value && typeof value === 'object' && normalizeAssetPath(value.url) === assetRelPath) {
          this._scheduleDeployBlueprint(info.id)
          break
        }
      }
    }
  }
}

export async function main() {
  const worldUrl = process.env.WORLD_URL
  const worldId = process.env.WORLD_ID || null
  if (!worldUrl) {
    console.error('Missing env WORLD_URL (e.g. http://localhost:3000)')
    process.exit(1)
  }
  const auth = await ensureProjectAuth({
    rootDir: process.cwd(),
    worldUrl,
    worldId,
    requiredCapability: 'builder',
    interactive: process.stdin.isTTY,
    log: console,
  })
  const server = new DirectAppServer({
    worldUrl,
    authToken: auth.entry.authToken,
    worldId,
  })
  await server.start()
  const shutdown = async () => {
    await server.stop()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  await new Promise(() => {})
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
