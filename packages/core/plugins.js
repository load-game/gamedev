function toArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

const scriptScopes = ['world', 'app', 'player']

function normalizeSystemEntry(entry, pluginName) {
  if (Array.isArray(entry)) {
    const [key, System] = entry
    if (!key || typeof key !== 'string') {
      throw new Error(`plugin_invalid_system_key:${pluginName}`)
    }
    if (typeof System !== 'function') {
      throw new Error(`plugin_invalid_system:${pluginName}:${key}`)
    }
    return { key, System }
  }

  if (!entry || typeof entry !== 'object') {
    throw new Error(`plugin_invalid_system:${pluginName}`)
  }

  const key = entry.key
  const System = entry.System || entry.system
  if (!key || typeof key !== 'string') {
    throw new Error(`plugin_invalid_system_key:${pluginName}`)
  }
  if (typeof System !== 'function') {
    throw new Error(`plugin_invalid_system:${pluginName}:${key}`)
  }
  return { key, System }
}

function normalizeNodeEntry(entry, pluginName) {
  if (Array.isArray(entry)) {
    const [key, Node] = entry
    if (!key || typeof key !== 'string') {
      throw new Error(`plugin_invalid_node_key:${pluginName}`)
    }
    if (typeof Node !== 'function') {
      throw new Error(`plugin_invalid_node:${pluginName}:${key}`)
    }
    return { key, Node }
  }

  if (!entry || typeof entry !== 'object') {
    throw new Error(`plugin_invalid_node:${pluginName}`)
  }

  const key = entry.key
  const Node = entry.Node || entry.node
  if (!key || typeof key !== 'string') {
    throw new Error(`plugin_invalid_node_key:${pluginName}`)
  }
  if (typeof Node !== 'function') {
    throw new Error(`plugin_invalid_node:${pluginName}:${key}`)
  }
  return { key, Node }
}

function normalizeNodeEntries(value, pluginName) {
  if (!value) return []
  if (Array.isArray(value)) return value.map(entry => normalizeNodeEntry(entry, pluginName))
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, Node]) => normalizeNodeEntry([key, Node], pluginName))
  }
  throw new Error(`plugin_invalid_nodes:${pluginName}`)
}

function normalizeEntityEntry(entry, pluginName) {
  if (Array.isArray(entry)) {
    const [key, Entity] = entry
    if (!key || typeof key !== 'string') {
      throw new Error(`plugin_invalid_entity_key:${pluginName}`)
    }
    if (typeof Entity !== 'function') {
      throw new Error(`plugin_invalid_entity:${pluginName}:${key}`)
    }
    return { key, Entity, create: null }
  }

  if (!entry || typeof entry !== 'object') {
    throw new Error(`plugin_invalid_entity:${pluginName}`)
  }

  const key = entry.key
  const Entity = entry.Entity || entry.entity || null
  const create = entry.create || entry.factory || null
  if (!key || typeof key !== 'string') {
    throw new Error(`plugin_invalid_entity_key:${pluginName}`)
  }
  if (typeof Entity !== 'function' && typeof create !== 'function') {
    throw new Error(`plugin_invalid_entity:${pluginName}:${key}`)
  }
  return { key, Entity, create }
}

function normalizeEntityEntries(value, pluginName) {
  if (!value) return []
  if (Array.isArray(value)) return value.map(entry => normalizeEntityEntry(entry, pluginName))
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, Entity]) => normalizeEntityEntry([key, Entity], pluginName))
  }
  throw new Error(`plugin_invalid_entities:${pluginName}`)
}

function normalizeLoaderEntry(entry, pluginName) {
  if (Array.isArray(entry)) {
    const [type, load] = entry
    if (!type || typeof type !== 'string') {
      throw new Error(`plugin_invalid_loader_type:${pluginName}`)
    }
    if (typeof load !== 'function') {
      throw new Error(`plugin_invalid_loader:${pluginName}:${type}`)
    }
    return { type, load }
  }

  if (!entry || typeof entry !== 'object') {
    throw new Error(`plugin_invalid_loader:${pluginName}`)
  }

  const type = entry.type || entry.key
  const load = entry.load || entry.loader || entry.handle
  if (!type || typeof type !== 'string') {
    throw new Error(`plugin_invalid_loader_type:${pluginName}`)
  }
  if (typeof load !== 'function') {
    throw new Error(`plugin_invalid_loader:${pluginName}:${type}`)
  }
  return { type, load }
}

function normalizeLoaderEntries(value, pluginName) {
  if (!value) return []
  if (Array.isArray(value)) return value.map(entry => normalizeLoaderEntry(entry, pluginName))
  if (typeof value === 'object') {
    return Object.entries(value).map(([type, load]) => normalizeLoaderEntry([type, load], pluginName))
  }
  throw new Error(`plugin_invalid_loaders:${pluginName}`)
}

function normalizeScriptApiEntry(entry, pluginName, scope, key) {
  if (typeof entry === 'function') {
    return entry
  }

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`plugin_invalid_script_descriptor:${pluginName}:${scope}.${key}`)
  }

  const descriptor = {}
  if (Object.prototype.hasOwnProperty.call(entry, 'get')) {
    if (typeof entry.get !== 'function') {
      throw new Error(`plugin_invalid_script_descriptor:${pluginName}:${scope}.${key}`)
    }
    descriptor.get = entry.get
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'set')) {
    if (typeof entry.set !== 'function') {
      throw new Error(`plugin_invalid_script_descriptor:${pluginName}:${scope}.${key}`)
    }
    descriptor.set = entry.set
  }
  if (!descriptor.get && !descriptor.set) {
    throw new Error(`plugin_invalid_script_descriptor:${pluginName}:${scope}.${key}`)
  }
  return Object.freeze(descriptor)
}

function normalizeScriptApiScope(value, pluginName, scope) {
  if (!value) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`plugin_invalid_script_scope:${pluginName}:${scope}`)
  }

  const entries = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!key || typeof key !== 'string') {
      throw new Error(`plugin_invalid_script_key:${pluginName}:${scope}`)
    }
    entries[key] = normalizeScriptApiEntry(entry, pluginName, scope, key)
  }
  return Object.freeze(entries)
}

function normalizeScriptApiContribution(value, pluginName) {
  if (!value) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`plugin_invalid_scripts:${pluginName}`)
  }

  for (const scope of Object.keys(value)) {
    if (!scriptScopes.includes(scope)) {
      throw new Error(`plugin_invalid_script_scope:${pluginName}:${scope}`)
    }
  }

  const contribution = {}
  for (const scope of scriptScopes) {
    const normalized = normalizeScriptApiScope(value[scope], pluginName, scope)
    if (normalized && Object.keys(normalized).length) {
      contribution[scope] = normalized
    }
  }
  return Object.keys(contribution).length ? Object.freeze(contribution) : null
}

export function definePlugin(definition) {
  if (!definition || typeof definition !== 'object') {
    throw new Error('plugin_invalid_definition')
  }
  if (!definition.name || typeof definition.name !== 'string') {
    throw new Error('plugin_missing_name')
  }

  const name = definition.name
  const systems = toArray(definition.systems).map(system => normalizeSystemEntry(system, name))
  const nodes = normalizeNodeEntries(definition.nodes, name)
  const entities = normalizeEntityEntries(definition.entities, name)
  const loaders = normalizeLoaderEntries(definition.loaders, name)
  const scripts = normalizeScriptApiContribution(definition.scripts || definition.scriptApi, name)

  return Object.freeze({
    kind: 'plugin',
    name,
    requires: Object.freeze(toArray(definition.requires).map(String)),
    optional: Object.freeze(toArray(definition.optional).map(String)),
    provides: Object.freeze(toArray(definition.provides).map(String)),
    systems: Object.freeze(systems),
    nodes: Object.freeze(nodes),
    entities: Object.freeze(entities),
    loaders: Object.freeze(loaders),
    scripts,
    setup: typeof definition.setup === 'function' ? definition.setup : null,
  })
}

export function definePreset(definition) {
  if (!definition || typeof definition !== 'object') {
    throw new Error('preset_invalid_definition')
  }
  if (!definition.name || typeof definition.name !== 'string') {
    throw new Error('preset_missing_name')
  }

  return Object.freeze({
    kind: 'preset',
    name: definition.name,
    plugins: Object.freeze(toArray(definition.plugins)),
    setup: typeof definition.setup === 'function' ? definition.setup : null,
  })
}

function assertPluginState(world) {
  if (!world.plugins) world.plugins = []
  if (!world.pluginCapabilities) world.pluginCapabilities = new Set()
}

function getProvidedCapabilities(plugin) {
  return new Set([
    plugin.name,
    ...plugin.provides,
    ...plugin.systems.map(system => system.key),
    ...plugin.nodes.map(node => `node:${node.key}`),
    ...plugin.entities.map(entity => `entity:${entity.key}`),
    ...plugin.loaders.map(loader => `loader:${loader.type}`),
    ...getScriptCapabilities(plugin.scripts),
  ])
}

function getScriptCapabilities(scripts) {
  if (!scripts) return []
  const capabilities = []
  for (const scope of scriptScopes) {
    for (const key of Object.keys(scripts[scope] || {})) {
      capabilities.push(`script:${scope}.${key}`)
    }
  }
  return capabilities
}

function installPlugin(world, pluginDefinition) {
  assertPluginState(world)
  const plugin = pluginDefinition?.kind === 'plugin' ? pluginDefinition : definePlugin(pluginDefinition)
  const source = plugin.name

  if (world.plugins.some(installed => installed.name === plugin.name)) {
    throw new Error(`plugin_already_installed:${plugin.name}`)
  }

  for (const requirement of plugin.requires) {
    if (!world.pluginCapabilities.has(requirement)) {
      throw new Error(`plugin_missing_requirement:${plugin.name}:${requirement}`)
    }
  }

  const capabilities = getProvidedCapabilities(plugin)
  for (const capability of capabilities) {
    if (world.pluginCapabilities.has(capability)) {
      throw new Error(`plugin_capability_collision:${plugin.name}:${capability}`)
    }
  }
  if (plugin.scripts && world.apps?.assertScriptApiAvailable) {
    world.apps.assertScriptApiAvailable(plugin.scripts, source)
  }
  const installsLoaderSystem = plugin.systems.some(system => system.key === 'loader')
  if (plugin.loaders.length && !installsLoaderSystem && !world.loader?.register) {
    throw new Error(`plugin_missing_loader_registry:${plugin.name}:${plugin.loaders[0].type}`)
  }

  for (const node of plugin.nodes) {
    world.registerNode(node.key, node.Node, { plugin: plugin.name })
  }
  for (const entity of plugin.entities) {
    world.registerEntity(entity.key, entity, { plugin: plugin.name })
  }
  for (const system of plugin.systems) {
    world.register(system.key, system.System, { plugin: plugin.name })
  }
  for (const loader of plugin.loaders) {
    if (!world.loader?.register) {
      throw new Error(`plugin_missing_loader_registry:${plugin.name}:${loader.type}`)
    }
    world.loader.register(loader.type, loader.load, { plugin: plugin.name })
  }
  for (const capability of capabilities) {
    world.pluginCapabilities.add(capability)
  }

  plugin.setup?.(world)
  if (plugin.scripts) {
    world.exposeScripts(plugin.scripts, source)
  }

  world.plugins.push(plugin)
  return plugin
}

function installPreset(world, presetDefinition) {
  const preset = presetDefinition?.kind === 'preset' ? presetDefinition : definePreset(presetDefinition)
  for (const plugin of preset.plugins) {
    installWorldExtension(world, plugin)
  }
  preset.setup?.(world)
  return preset
}

export function installWorldExtension(world, extension) {
  if (Array.isArray(extension)) {
    for (const item of extension) {
      installWorldExtension(world, item)
    }
    return extension
  }
  if (extension?.kind === 'preset' || extension?.plugins) {
    return installPreset(world, extension)
  }
  return installPlugin(world, extension)
}
