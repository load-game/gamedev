# Monorepo Relative Import Audit

Static scan of relative `import`/`export`/`require` specifiers that originally resolved into a different workspace package.

Current status: most listed cases have been converted to workspace package imports, with one publish-specific exception. Runtime files shipped and executed directly by the root `gamedev` package use relative paths into packaged workspace folders so npm installs do not need private `workspace:*` runtime dependencies.

## Migration Checklist

- [x] Add missing `workspace:*` dependency edges to workspace package manifests.
- [x] Keep published `@gamedev/app-server` runtime imports of `@gamedev/core` package-local.
- [x] Keep published `@gamedev/cli` runtime imports of `@gamedev/app-server` package-local.
- [x] Convert `@gamedev/client` imports of `@gamedev/core`.
- [x] Convert `@gamedev/node-client` imports of `@gamedev/core`.
- [x] Convert `@gamedev/server` imports of `@gamedev/core`.
- [x] Convert root `gamedev` imports of workspace packages in `scripts/`, `test/`, and `*.d.ts`.
- [x] Normalize package-internal relative imports to explicit file specifiers for Node ESM.
- [x] Refresh the workspace install / lockfile for the new package edges.
- [x] Verify published runtime entrypoints do not require private workspace runtime dependencies.

## Baseline Audit Summary

- Workspace packages contain **110** cross-package relative imports across **45** files.
- Root-owned code (`scripts/`, `test/`, `index.node-client.d.ts`) contains **63** more cross-package relative imports across **46** files.
- Missing workspace dependency edges in package manifests:
  - `@gamedev/app-server` -> `@gamedev/core` (`declared: None`)
  - `@gamedev/cli` -> `@gamedev/app-server` (`declared: None`)
  - `@gamedev/client` -> `@gamedev/core` (`declared: None`)
  - `@gamedev/node-client` -> `@gamedev/core` (`declared: None`)
  - `@gamedev/server` -> `@gamedev/core` (`declared: None`)

## Package Manifest Gaps

- `@gamedev/app-server` should declare `@gamedev/core: "workspace:*"` in `packages/app-server/package.json`.
- `@gamedev/cli` should declare `@gamedev/app-server: "workspace:*"` in `packages/cli/package.json`.
- `@gamedev/client` should declare `@gamedev/core: "workspace:*"` in `packages/client/package.json`.
- `@gamedev/node-client` should declare `@gamedev/core: "workspace:*"` in `packages/node-client/package.json`.
- `@gamedev/server` should declare `@gamedev/core: "workspace:*"` in `packages/server/package.json`.

## Workspace Package Consumers

### `@gamedev/app-server` -> `@gamedev/core` (4 imports, 4 files)

- `packages/app-server/WorldAdminClient.js`: lines 4
- `packages/app-server/commands.js`: lines 14
- `packages/app-server/direct.js`: lines 92
- `packages/app-server/helpers.js`: lines 8

### `@gamedev/cli` -> `@gamedev/app-server` (6 imports, 1 files)

- `packages/cli/gamedev.mjs`: lines 9, 10, 11, 12, 13, 14

### `@gamedev/client` -> `@gamedev/core` (64 imports, 30 files)

- `packages/client/AvatarPreview.js`: lines 3
- `packages/client/admin-client.js`: lines 5, 9
- `packages/client/admin.js`: lines 2
- `packages/client/builtinApps.js`: lines 1
- `packages/client/components/AppsList.js`: lines 17
- `packages/client/components/AppsPane.js`: lines 27, 28
- `packages/client/components/CoreUI.js`: lines 10, 11
- `packages/client/components/CurvePane.js`: lines 4
- `packages/client/components/Fields.js`: lines 6, 8, 13
- `packages/client/components/Inputs.js`: lines 6
- `packages/client/components/MainMenu.js`: lines 14, 15, 16, 17, 18, 19
- `packages/client/components/Menu.js`: lines 5, 7, 9
- `packages/client/components/MenuApp.js`: lines 18, 22
- `packages/client/components/ScriptFilesEditor.js`: lines 4, 5, 6
- `packages/client/components/ScriptFilesEditor/scriptFileUtils.js`: lines 2
- `packages/client/components/Sidebar.js`: lines 7, 9, 11, 12, 16
- `packages/client/components/editor/BottomPanel.js`: lines 9, 10, 11
- `packages/client/components/editor/LeftPanel.js`: lines 12
- `packages/client/components/editor/RightPanel.js`: lines 5
- `packages/client/components/sidebar/Add.js`: lines 7
- `packages/client/components/sidebar/App.js`: lines 29, 30, 31, 32, 33, 34
- `packages/client/components/sidebar/Script.js`: lines 7
- `packages/client/components/sidebar/World.js`: lines 5
- `packages/client/components/sidebar/utils/ScriptAIController.js`: lines 1, 2, 3, 4
- `packages/client/components/usePane.js`: lines 3
- `packages/client/components/useWalletAuth.js`: lines 2
- `packages/client/index.js`: lines 4, 12, 13
- `packages/client/particles.js`: lines 3, 4
- `packages/client/utils.js`: lines 1
- `packages/client/world-client.js`: lines 2, 7, 13

### `@gamedev/node-client` -> `@gamedev/core` (4 imports, 1 files)

- `packages/node-client/index.js`: lines 2, 9, 10, 11

### `@gamedev/server` -> `@gamedev/core` (35 imports, 10 files)

- `packages/server/AssetsLocal.js`: lines 3
- `packages/server/AssetsS3.js`: lines 10
- `packages/server/admin.js`: lines 4, 5, 6
- `packages/server/cliAuth.js`: lines 3, 4, 5
- `packages/server/presets/server.js`: lines 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14
- `packages/server/db.js`: lines 4, 6
- `packages/server/index.js`: lines 2, 52, 53
- `packages/server/plugins/network/ServerNetwork.js`: lines 2, 3, 4, 5, 6, 8, 9, 10
- `packages/server/plugins/network/server.js`: lines 1
- `packages/server/syncMetadata.js`: lines 1

## Root Package Consumers

### `gamedev` -> `@gamedev/app-server` (18 imports, 15 files)

- `test/integration/app-bootstrap.test.js`: lines 5
- `test/integration/app-deploy-bundle.test.js`: lines 5
- `test/integration/app-server-world-url.test.js`: lines 3, 4
- `test/integration/app-watch.test.js`: lines 5
- `test/integration/asset-dedupe.test.js`: lines 7
- `test/integration/deploy-scope.test.js`: lines 7
- `test/integration/project-auth-store.test.js`: lines 4
- `test/integration/sync-phase1.test.js`: lines 5
- `test/integration/sync-phase2.test.js`: lines 6
- `test/integration/sync-phase4.test.js`: lines 7
- `test/integration/sync-phase5.test.js`: lines 7, 8
- `test/integration/sync-phase6.test.js`: lines 7
- `test/integration/workflow.test.js`: lines 5, 6
- `test/integration/world-export-scripts.test.js`: lines 6
- `test/integration/world-sync-scripts.test.js`: lines 6

### `gamedev` -> `@gamedev/client` (1 imports, 1 files)

- `test/integration/runtime-wallet-adapter.test.js`: lines 4

### `gamedev` -> `@gamedev/core` (28 imports, 17 files)

- `index.node-client.d.ts`: lines 1
- `test/integration/admin-client-runtime-credentials.test.js`: lines 3, 4
- `test/integration/app-entity-modify.test.js`: lines 4
- `test/integration/app-module-script.test.js`: lines 6, 7
- `test/integration/blueprint-validation.test.js`: lines 3
- `test/integration/blueprint-variant-naming.test.js`: lines 3, 4
- `test/integration/helpers.js`: lines 11
- `test/integration/hyp-codec.test.js`: lines 4, 5
- `test/integration/hyp-extract-script-entry.test.js`: lines 7
- `test/integration/hyp-import-script-files.test.js`: lines 4, 5
- `test/integration/hyperliquid-client.test.js`: lines 5, 6, 7
- `test/integration/legacy-body-compiler.test.js`: lines 3
- `test/integration/module-loader.test.js`: lines 6, 7
- `test/integration/module-specifiers.test.js`: lines 3
- `test/integration/runtime-cli-auth.test.js`: lines 8, 9
- `test/integration/runtime-standby-bootstrap.test.js`: lines 9, 10, 11
- `test/integration/server-ai-scripts-detach.test.js`: lines 3

### `gamedev` -> `@gamedev/server` (16 imports, 15 files)

- `scripts/bootstrap-runtime.mjs`: lines 8
- `test/integration/admin-credentials-command.test.js`: lines 3
- `test/integration/admin-shutdown-command.test.js`: lines 4
- `test/integration/agones-idle-shutdown.test.js`: lines 4
- `test/integration/agones-player-tracking.test.js`: lines 6
- `test/integration/agones-sdk-http.test.js`: lines 4
- `test/integration/assets-s3.test.js`: lines 6
- `test/integration/auth-modes.test.js`: lines 4
- `test/integration/runtime-bootstrap.test.js`: lines 3
- `test/integration/runtime-cli-auth.test.js`: lines 10
- `test/integration/runtime-standby-bootstrap.test.js`: lines 12
- `test/integration/runtime-startup.test.js`: lines 4
- `test/integration/server-storage.test.js`: lines 6
- `test/integration/websocket-connection.test.js`: lines 4
- `test/integration/world-limits.test.js`: lines 3, 4
