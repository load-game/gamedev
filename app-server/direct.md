# DirectAppServer

Bidirectional sync between a local project directory and a remote Hyperfy world. Handles blueprints, entities, assets, scripts, file watching, and conflict resolution.

## Public API

| Method | Description |
|--------|-------------|
| `constructor({ worldUrl, authToken, worldId, rootDir })` | Initialize with world URL, cached auth token, world id, and local root dir |
| `connect({ refreshSyncState, syncCursorFromChangefeed })` | Connect to world admin API and load snapshot |
| `start()` | Connect, deploy all apps, start file watchers |
| `stop()` | Disconnect, stop watchers and timers |
| `deployApp(appName, options)` | Deploy a specific app to the world |
| `deployBlueprint(id)` | Deploy a specific blueprint by ID |
| `exportWorldToDisk(snapshot, options)` | Write world snapshot to local files |
| `importWorldFromDisk()` | Push local files to the world |
| `listSyncConflictArtifacts({ includeResolved })` | List stored conflict artifacts |
| `getSyncConflictArtifact(conflictId)` | Get a specific conflict artifact |
| `promptAndResolveSyncConflicts({ conflictIds })` | Interactive CLI conflict resolution |
| `resolveSyncConflict(conflictId, { use })` | Resolve conflict with `local`/`remote`/`merged` |

---

## Internals by Area

### Connection & Startup
- `_validateWorldId`  verify local WORLD_ID matches remote
- `_initSnapshot`  load snapshot into internal state
- `_bootstrapEmptyProject` / `_isDefaultWorldSnapshot` / `_scaffoldLocalProject`  first-run setup
- `_startReconnectLoop`  auto-reconnect on disconnect
- `_logTarget`  log deploy target once

### Sync State
- `_readSyncState` / `_writeSyncState` / `_refreshSyncState`  persist sync cursor + baseline hashes
- `_buildSyncStateSnapshot` / `_withDeferredSyncStateWrites` / `_setSyncCursor`
- `_buildSyncObjectIndex` / `_buildSyncWorldEntry` / `_syncEntriesById` / `_hashSyncObject`  build hashes per object
- `_syncCursorFromChangefeed` / `_getRuntimeHeadCursor`  cursor management
- `_isBidirectionalSyncEnabled` / `_isStrictSyncConflictsEnabled`

### Sync Policy (ownership rules)
- `_readSyncPolicy`  load `.lobby/sync-policy.json`
- `_getBlueprintScriptOwnership` / `_getBlueprintMetadataOwnership` / `_getBlueprintPropsOwnership`
- `_getEntityTransformOwnership` / `_getEntityPropsOwnership` / `_getEntityStateOwnership`
- `_getWorldSettingsOwnership` / `_getSpawnOwnership`

### Startup Handshake (initial reconcile)
- `_runStartupHandshake`  diff local vs remote, apply changes
- `_computeStartupHandshakePlan`  build plan (local-only / remote-only / concurrent)
- `_buildLocalBlueprintPayloadIndex`
- `_applyRemoteOnlyBlueprintChanges` / `_pushLocalOnlyBlueprintChanges` / `_applyMergedBlueprintChanges`

### Conflict Resolution
- `_reconcileBlueprint` / `_reconcileEntity` / `_reconcileSettings` / `_reconcileSpawn`  three-way merge per object
- `_resolveBlueprintField` / `_resolveEntityField`  per-field resolution with ownership policy
- `_createSyncConflict`  package unresolvable conflict
- `_writeSyncConflictArtifacts` / `_pruneSyncConflictArtifacts` / `_recordSyncConflicts`
- `_markSyncConflictResolvedInState` / `_markSyncConflictArtifactResolved`
- `_resolveSyncConflictsInBulk` / `_resolveSyncConflictsOneByOne` / `_promptSyncConflictResolutionLine`
- `_applyResolvedBlueprintToLocal` / `_applyResolvedEntityToRuntime` / `_applyResolvedSettingsToRuntime` / `_applyResolvedSpawnToRuntime`

### Blueprint Identity Index
- `_readBlueprintIdentityIndex` / `_writeBlueprintIdentityIndex`  persist `.lobby/blueprint-index.json`
- `_buildBlueprintIdentityLookup` / `_syncBlueprintIdentityIndex`
- `_resolveIndexedBlueprintId` / `_resolveIndexedBlueprintUid` / `_getBlueprintIdentityRecord`
- `_resolveBlueprintProjection` / `_getAppNameFromProjectionPath`

### Blueprint Management
- `_indexLocalBlueprints` / `_hasLocalApps` / `_getBlueprintIdsForApp`
- `_prepareBlueprintPayload` / `_resolveBlueprintPayloadName` / `_resolveBlueprintPayloadScope` / `_resolveBlueprintPayloadScript`
- `_buildDeployPlan` / `_summarizeDeployPlan` / `_printDeployPlan`
- `_deployAllBlueprints` / `_deployBlueprintsForApp` / `_deployBlueprintsForAppInternal` / `_deployBlueprintById` / `_deployBlueprint`
- `_writeBlueprintToDisk` / `_blueprintToLocalConfig` / `_removeLocalBlueprintFromDisk` / `_maybeRemoveEmptyAppFolder`
- `_removeBlueprintsAndEntities` / `_removeAppFromWorld`
- `_scheduleDeployApp` / `_scheduleDeployBlueprint` / `_scheduleRemoveApp` / `_scheduleRemoveBlueprint`

### Remote Event Handlers
- `_attachRemoteHandlers`  subscribe to world websocket events
- `_onRemoteBlueprint` / `_onRemoteBlueprintRemoved`

### Script Management
- `_resolveAppScriptMode` / `_getScriptFormat` / `_syncScriptFormatForApp`
- `_getScriptPath` / `_getConfiguredScriptEntries` / `_getSnapshotScriptEntry` / `_resolveScriptEntryPath`
- `_uploadScriptForApp` / `_uploadScriptFilesForApp` / `_safeUploadScriptForApp`
- `_buildScriptPayload` / `_resolveScriptRootId` / `_isMissingScriptError`
- `_downloadScript` / `_syncScriptSourcesToDisk` / `_resolveRemoteScriptRootBlueprint`

### Asset Management
- `_resolveLocalAssetToWorldUrl` / `_resolveLocalBlueprintToAssetUrls` / `_resolveLocalEntityPropsToAssetUrls`  upload local assets, replace paths with `asset://` URLs
- `_findLocalAssetByHash` / `_maybeDownloadAsset`  download remote assets to local
- `_localizeEntityProps`  download assets referenced in entity props
- `_onAssetChanged`  handle local asset file changes

### File Watching
- `_startWatchers`  start all watchers
- `_watchAppsDir` / `_watchAppDir` / `_watchAppDirRecursive` / `_watchAppPath`
- `_watchSharedDir` / `_watchSharedDirRecursive` / `_watchSharedPath`
- `_watchWorldFile` / `_watchAssetsDir`
- `_scheduleDeployAppsForSharedPath` / `_getAppsUsingSharedPath`
- `_closeWatcher` / `_closeWatchersUnderDir`

### World/Manifest
- `_writeWorldFile` / `_writeManifestFromSnapshot` / `_scheduleManifestWrite`
- `_onWorldFileChanged`  handle world.json edits
- `_applyManifestToWorld`  push manifest settings/entities to world
- `_buildManifestEntityIndex` / `_buildManifestEntityStateOwnershipIndex`
- `_upsertManifestEntity` / `_removeManifestEntity` / `_readManifestForSyncResolve`

### Deploy Lock
- `_acquireDeployLock` / `_releaseDeployLock` / `_withDeployLock`
- `_getDeployLockOwner` / `_getDeployTargetName`
- `_createDeploySnapshot`

### File Utilities
- `_writeFileAtomic` / `_deleteFileAtomic` / `_pruneEmptyDirs`
- `_normalizeSnapshotCollection` / `_normalizeSnapshotForExport` / `_normalizeBaselineSyncValue`
