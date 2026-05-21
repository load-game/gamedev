function toArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

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

export function definePlugin(definition) {
  if (!definition || typeof definition !== 'object') {
    throw new Error('plugin_invalid_definition')
  }
  if (!definition.name || typeof definition.name !== 'string') {
    throw new Error('plugin_missing_name')
  }

  const name = definition.name
  const systems = toArray(definition.systems).map(system => normalizeSystemEntry(system, name))

  return Object.freeze({
    kind: 'plugin',
    name,
    requires: Object.freeze(toArray(definition.requires).map(String)),
    optional: Object.freeze(toArray(definition.optional).map(String)),
    provides: Object.freeze(toArray(definition.provides).map(String)),
    systems: Object.freeze(systems),
    scripts: definition.scripts || definition.scriptApi || null,
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
  return new Set([plugin.name, ...plugin.provides, ...plugin.systems.map(system => system.key)])
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

  for (const system of plugin.systems) {
    world.register(system.key, system.System, { plugin: plugin.name })
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
