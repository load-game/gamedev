import * as THREE from '../extras/three'
import { N8AOPostPass } from 'n8ao'
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAPreset,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  SelectiveBloomEffect,
  BlendFunction,
  Selection,
  BloomEffect,
  KernelSize,
  DepthPass,
  Pass,
  DepthEffect,
  DepthOfFieldEffect,
} from 'postprocessing'

/**
 * EffectRegistry - Config-driven Postprocessing Effect Management
 *
 * Provides a centralized, modular system for managing postprocessing effects
 * with preference-driven configuration and uniform updates.
 *
 * Features:
 * - Effect categories (postprocessing, rendering, lighting)
 * - Dependency resolution with topological sort
 * - Runtime effect registration
 * - Effect presets (high, medium, low quality)
 * - Effect configuration validation
 *
 * @example
 * const registry = new EffectRegistry(world)
 * registry.registerEffect('customBloom', customConfig)
 * registry.applyPreset('high')
 * const bloom = registry.createEffect('bloom', camera, world)
 * registry.updateUniform(bloom, 'intensity', 1.5)
 */
export class EffectRegistry {
  constructor(world) {
    this.world = world
    this.effects = new Map()
    this.instances = new Map()
    this.resolvedOrder = []

    // Initialize effect definitions
    this.initializeEffects()
    // Resolve effect dependencies
    this.resolveDependencies()
  }

    /**
   * Initialize effect definitions
   * @private
   */
  initializeEffects() {
    const definitions = this.getBuiltInEffectDefinitions()

    // Store effect definitions in Map for easier access
    for (const [name, config] of Object.entries(definitions)) {
      this.effects.set(name, config)
    }
  }

  /**
   * Built-in effect configurations
   * @private
   */
  getBuiltInEffectDefinitions() {
    return {
      bloom: {
        name: 'bloom',
        class: BloomEffect,
        enabled: 'bloom',
        category: 'postprocessing',
        dependencies: null,
        params: {
          blendFunction: BlendFunction.ADD,
          mipmapBlur: true,
          luminanceThreshold: 1,
          luminanceSmoothing: 0.3,
          intensity: 0.5,
          radius: 0.8,
          levels: 4,
        },
        uniforms: {
          intensity: 'bloomIntensity',
          radius: 'bloomRadius',
          luminanceThreshold: 'bloomLuminanceThreshold',
          luminanceSmoothing: 'bloomLuminanceSmoothing',
        },
      },

      dof: {
        name: 'dof',
        class: DepthOfFieldEffect,
        enabled: 'dofEnabled',
        category: 'postprocessing',
        dependencies: ['camera'],
        params: {
          blendFunction: BlendFunction.NORMAL,
          focusDistance: 50,
          focalLength: 0.024,
          bokehScale: 3, // 0.03 * 100 = 3 (much less blur)
          height: 480,
        },
        uniforms: {
          // Circle of confusion uniforms
          'circleOfConfusionMaterial.uniforms.focusDistance': 'dofFocusDistance',
          'circleOfConfusionMaterial.uniforms.focalLength': 'dofFocalLength',
          'circleOfConfusionMaterial.uniforms.fStop': 'dofFStop',
          'circleOfConfusionMaterial.uniforms.maxBlur': 'dofMaxBlur',
          'circleOfConfusionMaterial.uniforms.luminanceThreshold': 'dofLuminanceThreshold',
          'circleOfConfusionMaterial.uniforms.luminanceGain': 'dofLuminanceGain',
          'circleOfConfusionMaterial.uniforms.bias': 'dofBias',
          'circleOfConfusionMaterial.uniforms.fringe': 'dofFringe',
        },
        factory: (config, camera, world) => {
          const dof = new DepthOfFieldEffect(camera, {
            ...config.params,
            // Use worldFocusDistance for world unit distances (not normalized)
            // The DOF controller will update this dynamically
            worldFocusDistance: 50,
            focalLength: (world.prefs.dofFocalLength || 24) * 0.001,
            focusRange: (world.prefs.dofFocusRange || 30) / 1000, // Convert to normalized
            bokehScale: (world.prefs.dofMaxBlur || 0.01) * 2, // ULTRA SUBTLE: 0.001 * 2 = 0.002 (barely visible)
            height: 480,
          })

          // Store reference for dynamic updates
          dof.__world = world
          return dof
        },
      },

      smaa: {
        name: 'smaa',
        class: SMAAEffect,
        enabled: null, // Always enabled
        category: 'postprocessing',
        params: {
          preset: SMAAPreset.ULTRA,
        },
        uniforms: {},
      },

      tonemapping: {
        name: 'tonemapping',
        class: ToneMappingEffect,
        enabled: null, // Always enabled
        category: 'postprocessing',
        params: {
          mode: ToneMappingMode.ACES_FILMIC,
          adaptationRate: 0.5,
          whitePoint: new THREE.Color(1, 1, 1),
          middleGrey: 0.6,
          minLuminance: 0.01,
          maxLuminance: 64,
          averageLuminance: 0.25,
        },
        uniforms: {
          'adaptiveLuminanceMaterial.uniforms.adaptationRate': 'toneMapAdaptationRate',
          'toneMapMaterial.uniforms.whitePoint': 'toneMapWhitePoint',
          'toneMapMaterial.uniforms.middleGrey': 'toneMapMiddleGrey',
          'toneMapMaterial.uniforms.minLuminance': 'toneMapMinLuminance',
        },
      },

      ao: {
        name: 'ao',
        class: null, // Special case using n8ao
        enabled: 'ao',
        category: 'postprocessing',
        dependencies: ['aoPass'],
        params: {
          halfRes: true,
          screenSpaceRadius: true,
          aoRadius: 64,
          distanceFalloff: 0.3,
          intensity: 1,
          autoDetectTransparency: false,
        },
        uniforms: {
          'configuration.aoRadius': 'aoRadius',
          'configuration.distanceFalloff': 'aoDistanceFalloff',
          'configuration.intensity': 'aoIntensity',
          'configuration.halfRes': 'aoHalfRes',
          'configuration.screenSpaceRadius': 'aoScreenSpaceRadius',
        },
        factory: (config, camera, world) => {
          // Special handling for AO pass
          const aoPass = new N8AOPostPass(world.stage.scene, camera, world.width, world.height)
          aoPass.enabled = world.settings.ao && world.prefs.ao
          aoPass.configuration.halfRes = world.prefs.aoHalfRes ?? true
          aoPass.configuration.screenSpaceRadius = world.prefs.aoScreenSpaceRadius ?? true
          aoPass.configuration.aoRadius = world.prefs.aoRadius ?? 64
          aoPass.configuration.distanceFalloff = world.prefs.aoDistanceFalloff ?? 0.3
          aoPass.configuration.intensity = world.prefs.aoIntensity ?? 1
          return aoPass
        },
       },

      // Add more lighting and rendering categories for extensibility
      directionalLight: {
        name: 'directionalLight',
        class: null,
        enabled: null,
        category: 'lighting',
        dependencies: null,
        params: {
          color: '#ffffff',
          intensity: 1,
          position: [5, 10, 5],
          castShadow: true,
        },
        uniforms: {},
      },

      shadowMapping: {
        name: 'shadowMapping',
        class: null,
        enabled: 'shadowsEnabled',
        category: 'rendering',
        dependencies: ['directionalLight'],
        params: {
          enabled: true,
          type: THREE.PCFSoftShadowMap,
        },
        uniforms: {},
      },
    }
  }

  /**
   * Effect preset configurations
   * @private
   */
  getEffectPresets() {
    return {
      // High quality preset - maximum visual fidelity
      high: {
        bloom: {
          enabled: true,
          intensity: 1.0,
          radius: 1.0,
          luminanceThreshold: 0.8,
        },
        dof: {
          enabled: true,
          focusDistance: 50,
          focalLength: 0.024,
          maxBlur: 0.05,
        },
        ao: {
          enabled: true,
          intensity: 1.5,
          aoRadius: 64,
          halfRes: false,
          screenSpaceRadius: true,
        },
        smaa: {
          enabled: true,
        },
        tonemapping: {
          enabled: true,
          adaptationRate: 0.3,
        },
        shadowsEnabled: true,
      },

      // Medium quality preset - balanced performance and quality
      medium: {
        bloom: {
          enabled: true,
          intensity: 0.5,
          radius: 0.8,
          luminanceThreshold: 1.0,
        },
        dof: {
          enabled: false,
        },
        ao: {
          enabled: true,
          intensity: 1.0,
          aoRadius: 32,
          halfRes: true,
          screenSpaceRadius: true,
        },
        smaa: {
          enabled: true,
        },
        tonemapping: {
          enabled: true,
          adaptationRate: 0.5,
        },
        shadowsEnabled: true,
      },

      // Low quality preset - maximum performance
      low: {
        bloom: {
          enabled: false,
        },
        dof: {
          enabled: false,
        },
        ao: {
          enabled: false,
        },
        smaa: {
          enabled: true,
        },
        tonemapping: {
          enabled: true,
          adaptationRate: 1.0,
        },
        shadowsEnabled: false,
      },

      // Custom presets can be added by plugins
      cinematic: {
        bloom: {
          enabled: true,
          intensity: 1.5,
          radius: 1.2,
          luminanceThreshold: 0.6,
        },
        dof: {
          enabled: true,
          focusDistance: 30,
          focalLength: 0.035,
          maxBlur: 0.08,
        },
        ao: {
          enabled: true,
          intensity: 2.0,
          aoRadius: 80,
          halfRes: false,
          screenSpaceRadius: true,
        },
        smaa: {
          enabled: true,
        },
        tonemapping: {
          enabled: true,
          adaptationRate: 0.1,
        },
        shadowsEnabled: true,
      },
    }
  }

  /**
   * Resolve effect dependencies using topological sort
   * @private
   */
  resolveDependencies() {
    const visited = new Set()
    const visiting = new Set()
    const sorted = []

    const visit = (name) => {
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected in effects: ${name}`)
      }
      if (visited.has(name)) return

      visiting.add(name)
      const config = this.effects.get(name)

      if (config && config.dependencies) {
        for (const dep of config.dependencies) {
          if (this.effects.has(dep) || dep === 'camera' || dep === 'aoPass') {
            visit(dep)
          }
        }
      }

      visiting.delete(name)
      visited.add(name)
      sorted.push(name)
    }

    for (const name of this.effects.keys()) {
      visit(name)
    }

    this.resolvedOrder = sorted
    // console.log('[EffectRegistry] Effect dependency order resolved:', this.resolvedOrder)
  }

  /**
   * Validate effect configuration
   * @param {Object} config - Effect configuration
   * @param {string} name - Effect name
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  validateEffectConfig(config, name) {
    const errors = []

    if (!config || typeof config !== 'object') {
      errors.push('Configuration must be an object')
      return { valid: false, errors }
    }

    // Check required fields
    if (!config.name || typeof config.name !== 'string') {
      errors.push('Effect must have a valid name string')
    }

    if (!config.category || typeof config.category !== 'string') {
      errors.push('Effect must have a valid category string')
    }

    // Validate category
    const validCategories = ['postprocessing', 'rendering', 'lighting']
    if (!validCategories.includes(config.category)) {
      errors.push(`Invalid category: ${config.category}. Must be one of: ${validCategories.join(', ')}`)
    }

    // Check dependencies
    if (config.dependencies && !Array.isArray(config.dependencies)) {
      errors.push('Dependencies must be an array')
    }

    // Validate class or factory
    if (!config.class && !config.factory) {
      errors.push('Effect must have either a class or factory function')
    }

    // Validate params
    if (config.params && typeof config.params !== 'object') {
      errors.push('Params must be an object')
    }

    // Validate uniforms mapping
    if (config.uniforms && typeof config.uniforms !== 'object') {
      errors.push('Uniforms must be an object')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Get configuration for a specific effect
   * @param {string} name - Effect name
   * @returns {Object|null} Effect configuration
   */
  getEffectConfig(name) {
    return this.effects.get(name) || null
  }

  /**
   * Get all effect configurations
   * @param {string} [category] - Optional category filter
   * @returns {Object} All effect configurations
   */
  getAllEffects(category = null) {
    if (category) {
      const result = {}
      for (const [name, config] of this.effects) {
        if (config.category === category) {
          result[name] = config
        }
      }
      return result
    }
    return Object.fromEntries(this.effects)
  }

  /**
   * Get all effect configurations by category
   * @param {string} category - Category name
   * @returns {Array} Array of effect configurations
   */
  getEffectsByCategory(category) {
    return Array.from(this.effects.values()).filter(config => config.category === category)
  }

  /**
   * Register a new effect at runtime
   * @param {string} name - Effect name
   * @param {Object} config - Effect configuration
   * @returns {boolean} Success status
   */
  registerEffect(name, config) {
    // Validate configuration
    const validation = this.validateEffectConfig(config, name)
    if (!validation.valid) {
      console.error(`[EffectRegistry] Invalid configuration for effect ${name}:`, validation.errors)
      return false
    }

    // Check if effect already exists
    if (this.effects.has(name)) {
      console.warn(`[EffectRegistry] Effect ${name} already exists. Overwriting...`)
    }

    // Store effect
    this.effects.set(name, config)

    // Re-resolve dependencies
    this.resolveDependencies()

    // console.log(`[EffectRegistry] Registered effect: ${name} (${config.category})`)
    return true
  }

  /**
   * Unregister an effect
   * @param {string} name - Effect name
   * @returns {boolean} Success status
   */
  unregisterEffect(name) {
    if (!this.effects.has(name)) {
      console.warn(`[EffectRegistry] Effect ${name} not found`)
      return false
    }

    // Remove instance if active
    if (this.instances.has(name)) {
      this.removeEffect(name)
    }

    // Remove effect definition
    this.effects.delete(name)

    // Re-resolve dependencies
    this.resolveDependencies()

    console.log(`[EffectRegistry] Unregistered effect: ${name}`)
    return true
  }

  /**
   * Apply a preset configuration
   * @param {string} presetName - Preset name
   * @returns {boolean} Success status
   */
  applyPreset(presetName) {
    const presets = this.getEffectPresets()
    const preset = presets[presetName]

    if (!preset) {
      console.error(`[EffectRegistry] Unknown preset: ${presetName}`)
      return false
    }

    console.log(`[EffectRegistry] Applying preset: ${presetName}`)

    // Apply preset settings to world preferences
    for (const [effectName, settings] of Object.entries(preset)) {
      if (typeof settings === 'boolean') {
        // Simple boolean toggle
        this.world.prefs[`${effectName}`] = settings
      } else if (typeof settings === 'object') {
        // Object with multiple settings
        for (const [key, value] of Object.entries(settings)) {
          // Map to preference keys
          this.world.prefs[`${effectName}${key.charAt(0).toUpperCase() + key.slice(1)}`] = value
        }
      }
    }

    // Update existing effects if world preferences system is available
    if (this.world.prefs && typeof this.world.prefs.set === 'function') {
      this.world.prefs.set()
    }

    console.log(`[EffectRegistry] Preset ${presetName} applied successfully`)
    return true
  }

  /**
   * Register a new preset
   * @param {string} name - Preset name
   * @param {Object} config - Preset configuration
   * @returns {boolean} Success status
   */
  registerPreset(name, config) {
    if (!config || typeof config !== 'object') {
      console.error(`[EffectRegistry] Invalid preset configuration for ${name}`)
      return false
    }

    // Store preset (extend presets object)
    const presets = this.getEffectPresets()
    presets[name] = config
    this.presets = presets // Store reference for lookup

    console.log(`[EffectRegistry] Registered preset: ${name}`)
    return true
  }

  /**
   * Get all available presets
   * @returns {Object} All preset configurations
   */
  getAvailablePresets() {
    return this.presets || this.getEffectPresets()
  }

  /**
   * Get effect creation order based on dependencies
   * @returns {Array} Array of effect names in dependency order
   */
  getEffectCreationOrder() {
    return [...this.resolvedOrder]
  }

  /**
   * Create an effect instance
   * @param {string} name - Effect name
   * @param {THREE.Camera} camera - Camera for effect
   * @param {World} world - World instance
   * @returns {Object|null} Effect instance
   */
  createEffect(name, camera, world) {
    const config = this.getEffectConfig(name)
    if (!config) {
      console.warn(`[EffectRegistry] Unknown effect: ${name}`)
      return null
    }

    // Check dependencies with proper resolution
    if (config.dependencies) {
      for (const dep of config.dependencies) {
        if (dep === 'camera' && !camera) {
          console.warn(`[EffectRegistry] Effect ${name} requires camera`)
          return null
        }
        if (dep === 'aoPass' && config.name !== 'ao') {
          console.warn(`[EffectRegistry] AO is special case, handled separately`)
        }
        // Check if dependency effect exists and is active
        if (this.effects.has(dep) && !this.isEffectActive(dep) && dep !== 'camera' && dep !== 'aoPass') {
          console.warn(`[EffectRegistry] Effect ${name} requires ${dep}, but ${dep} is not active`)
          return null
        }
      }
    }

    // Check if effect should be enabled
    if (config.enabled && world.prefs[config.enabled] === false) {
      return null
    }

    let effect = null

    try {
      // Use factory if available
      if (config.factory) {
        effect = config.factory(config, camera, world)
      } else if (config.class) {
        // Standard effect creation
        const params = { ...config.params }

        // Apply preference overrides
        for (const [uniformKey, prefKey] of Object.entries(config.uniforms)) {
          if (world.prefs[prefKey] !== undefined) {
            // Handle nested properties
            const keys = uniformKey.split('.')
            let target = params
            for (let i = 0; i < keys.length - 1; i++) {
              const key = keys[i]
              if (!target[key]) target[key] = {}
              target = target[key]
            }
            target[keys[keys.length - 1]] = world.prefs[prefKey]
          }
        }

        effect = new config.class(params)
      }

      if (effect) {
        effect.__effectName = name
        effect.__config = config

        // Store instance for updates
        this.instances.set(name, effect)

        console.log(`[EffectRegistry] Created effect: ${name}`)
      }
    } catch (error) {
      console.error(`[EffectRegistry] Failed to create effect ${name}:`, error)
    }

    return effect
  }

  /**
   * Update a uniform on an effect
   * @param {Object} effect - Effect instance
   * @param {string} uniformName - Uniform name (supports nested notation)
   * @param {*} value - New value
   * @returns {boolean} Success status
   */
  updateUniform(effect, uniformName, value) {
    if (!effect) return false

    try {
      // Handle nested uniform access
      const keys = uniformName.split('.')
      let target = effect

      for (const key of keys) {
        if (target[key] === undefined) return false
        target = target[key]
      }

      target.value = value

      // Mark effect for recompilation if it has recompile method
      if (effect.recompile && typeof effect.recompile === 'function') {
        effect.recompile()
      }

      return true
    } catch (error) {
      console.error(`[EffectRegistry] Failed to update uniform ${uniformName}:`, error)
      return false
    }
  }

  /**
   * Update multiple effect parameters
   * @param {Object} effect - Effect instance
   * @param {Object} params - Parameter object
   * @returns {boolean} Success status
   */
  updateEffectParams(effect, params) {
    if (!effect || !params) return false

    let success = true

    for (const [key, value] of Object.entries(params)) {
      const result = this.updateUniform(effect, key, value)
      if (!result) success = false
    }

    return success
  }

  /**
   * Update effect from preferences
   * @param {string} name - Effect name
   * @param {Object} preferences - Preference changes
   * @returns {boolean} Success status
   */
  updateEffectFromPrefs(name, preferences) {
    const effect = this.instances.get(name)
    if (!effect) return false

    const config = this.getEffectConfig(name)
    if (!config || !config.uniforms) return false

    let updated = false

    for (const [uniformKey, prefKey] of Object.entries(config.uniforms)) {
      if (preferences[prefKey] !== undefined) {
        const value = preferences[prefKey].value ?? preferences[prefKey]

        // Special handling for DOF focus distance
        if (name === 'dof' && uniformKey === 'circleOfConfusionMaterial.uniforms.focusDistance') {
          const adjustedValue = value / (this.world.camera.far || 1200)
          if (this.updateUniform(effect, uniformKey, adjustedValue)) {
            updated = true
          }
        }
        // Special handling for DOF focal length
        else if (name === 'dof' && uniformKey === 'circleOfConfusionMaterial.uniforms.focalLength') {
          const adjustedValue = value * 0.001
          if (this.updateUniform(effect, uniformKey, adjustedValue)) {
            updated = true
          }
        }
        // Special handling for DOF bokeh scale
        else if (name === 'dof' && uniformKey === 'circleOfConfusionMaterial.uniforms.maxBlur') {
          const adjustedValue = value * 100
          if (this.updateUniform(effect, uniformKey, adjustedValue)) {
            updated = true
          }
        }
        // Standard uniform update
        else {
          if (this.updateUniform(effect, uniformKey, value)) {
            updated = true
          }
        }
      }
    }

    return updated
  }

  /**
   * Get effect instance by name
   * @param {string} name - Effect name
   * @returns {Object|null} Effect instance
   */
  getEffect(name) {
    return this.instances.get(name) || null
  }

  /**
   * Get all active effect instances
   * @returns {Array} Array of effect instances
   */
  getAllActiveEffects() {
    return Array.from(this.instances.values())
  }

  /**
   * Check if an effect is active
   * @param {string} name - Effect name
   * @returns {boolean} Whether effect is active
   */
  isEffectActive(name) {
    return this.instances.has(name)
  }

  /**
   * Remove an effect instance
   * @param {string} name - Effect name
   * @returns {boolean} Success status
   */
  removeEffect(name) {
    const effect = this.instances.get(name)
    if (!effect) return false

    // Dispose effect if it has dispose method
    if (effect.dispose && typeof effect.dispose === 'function') {
      effect.dispose()
    }

    this.instances.delete(name)
    console.log(`[EffectRegistry] Removed effect: ${name}`)
    return true
  }

  /**
   * Clear all effect instances
   */
  clearEffects() {
    for (const [name] of this.instances) {
      this.removeEffect(name)
    }
  }

  /**
   * Get supported effect names
   * @param {string} [category] - Optional category filter
   * @returns {Array} Array of effect names
   */
  getSupportedEffects(category = null) {
    const effects = this.getAllEffects(category)
    return Object.keys(effects)
  }

  /**
   * Destroy the registry and clean up all effects
   */
  destroy() {
    this.clearEffects()
    this.effects.clear()
    this.instances.clear()
  }
}