import path from 'node:path'

export const serverBuiltinsPlugin = Object.freeze({
  kind: 'server-bootstrap-plugin',
  name: '@gamedev/plugin-builtins/server',
  provides: Object.freeze(['server-builtins', 'default-world', 'builtin-assets']),
})

export const builtinAssetsPlugin = serverBuiltinsPlugin

export const DEFAULT_SCENE_BLUEPRINT_ID = '$scene'

export const DEFAULT_SCENE_TEMPLATE = Object.freeze({
  id: DEFAULT_SCENE_BLUEPRINT_ID,
  version: 0,
  name: 'Scene',
  image: null,
  author: null,
  url: null,
  desc: null,
  model: 'asset://Model.glb',
  script: 'asset://scene.js',
  scriptEntry: 'scene.js',
  scriptFiles: Object.freeze({
    'scene.js': 'asset://scene.js',
  }),
  scriptFormat: 'module',
  props: Object.freeze({
    hour: 4,
    period: 'pm',
    intensity: 1,
    sky: Object.freeze({
      url: 'asset://sky.jpg',
    }),
    hdr: Object.freeze({
      url: 'asset://sky.hdr',
    }),
    verticalRotation: 40,
    horizontalRotation: 230,
    rotationY: 0,
    fogNear: 450,
    fogFar: 1000,
    fogColor: '#97b4d3',
  }),
  preload: true,
  public: false,
  locked: false,
  frozen: false,
  unique: true,
  scene: true,
  disabled: false,
  keep: true,
})

export const BUILTIN_ASSET_SOURCE_PATHS = Object.freeze(['build/world/assets', 'packages/server/world/assets'])

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

export function getBuiltinAssetSourceDirs(rootDir) {
  return BUILTIN_ASSET_SOURCE_PATHS.map(sourcePath => path.join(rootDir, sourcePath))
}

export function resolveBuiltinAssetPath(rootDir, filename, exists = () => false) {
  for (const dir of getBuiltinAssetSourceDirs(rootDir)) {
    const candidate = path.join(dir, filename)
    if (exists(candidate)) return candidate
  }
  return null
}

export function createDefaultSceneBlueprintData() {
  return cloneJson(DEFAULT_SCENE_TEMPLATE)
}

export function createSettingsModelSceneBlueprintData(settings) {
  return {
    id: DEFAULT_SCENE_BLUEPRINT_ID,
    version: 0,
    name: 'Scene',
    image: null,
    author: null,
    url: null,
    desc: null,
    model: settings.model.url,
    script: null,
    props: null,
    preload: true,
    public: false,
    locked: false,
    frozen: false,
    unique: true,
    scene: true,
    disabled: false,
    keep: true,
  }
}

export function createSceneEntityData({ id, blueprintId = DEFAULT_SCENE_BLUEPRINT_ID }) {
  return {
    id,
    type: 'app',
    blueprint: blueprintId,
    position: [0, 0, 0],
    quaternion: [0, 0, 0, 1],
    scale: [1, 1, 1],
    mover: null,
    uploader: null,
    pinned: false,
    props: {},
    state: {},
  }
}

export function createDefaultWorldSeedRecords({ settings = {}, now, createId }) {
  const usesSettingsModel = !!settings.model
  const blueprintData = usesSettingsModel
    ? createSettingsModelSceneBlueprintData(settings)
    : createDefaultSceneBlueprintData()
  const entityId = createId()
  const nextSettings = usesSettingsModel ? { ...settings } : settings
  if (usesSettingsModel) {
    delete nextSettings.model
  }

  return {
    blueprint: {
      id: DEFAULT_SCENE_BLUEPRINT_ID,
      data: JSON.stringify(blueprintData),
      createdAt: now,
      updatedAt: now,
    },
    entity: {
      id: entityId,
      data: JSON.stringify(createSceneEntityData({ id: entityId, blueprintId: DEFAULT_SCENE_BLUEPRINT_ID })),
      createdAt: now,
      updatedAt: now,
    },
    settings: nextSettings,
    settingsChanged: usesSettingsModel,
  }
}
