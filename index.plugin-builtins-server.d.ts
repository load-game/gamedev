export interface ServerBootstrapPlugin {
  kind: 'server-bootstrap-plugin'
  name: string
  provides: readonly string[]
}

export interface DefaultWorldSeedRecords {
  blueprint: {
    id: string
    data: string
    createdAt: string
    updatedAt: string
  }
  entity: {
    id: string
    data: string
    createdAt: string
    updatedAt: string
  }
  settings: Record<string, any>
  settingsChanged: boolean
}

export declare const serverBuiltinsPlugin: ServerBootstrapPlugin
export declare const builtinAssetsPlugin: ServerBootstrapPlugin
export declare const DEFAULT_SCENE_BLUEPRINT_ID: '$scene'
export declare const DEFAULT_SCENE_TEMPLATE: Readonly<Record<string, any>>
export declare const BUILTIN_ASSET_SOURCE_PATHS: readonly string[]

export declare function getBuiltinAssetSourceDirs(rootDir: string): string[]
export declare function resolveBuiltinAssetPath(
  rootDir: string,
  filename: string,
  exists?: (filePath: string) => boolean
): string | null
export declare function createDefaultSceneBlueprintData(): Record<string, any>
export declare function createSettingsModelSceneBlueprintData(settings: Record<string, any>): Record<string, any>
export declare function createSceneEntityData(options: { id: string; blueprintId?: string }): Record<string, any>
export declare function createDefaultWorldSeedRecords(options: {
  settings?: Record<string, any>
  now: string
  createId: () => string
}): DefaultWorldSeedRecords
