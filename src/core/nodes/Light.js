import { isNumber, isString } from 'lodash-es'
import * as THREE from '../extras/three'
import { Node } from './Node'

const defaults = {
  type: 'point',
  color: '#ffffff',
  intensity: 1,
  distance: 100,
  decay: 2,
  angle: Math.PI / 3,
  penumbra: 0,
  castShadow: false,
}

const types = ['directional', 'point', 'spot']

export class Light extends Node {
  constructor(data = {}) {
    super(data)
    this.name = 'light'

    this.type = data.type
    this.color = data.color
    this.intensity = data.intensity
    this.distance = data.distance
    this.decay = data.decay
    this.angle = data.angle
    this.penumbra = data.penumbra
    this.castShadow = data.castShadow
  }

  mount() {
    this.needsRebuild = false
    if (this.world?.network?.isServer) return

    const color = new THREE.Color(this._color)

    switch (this._type) {
      case 'directional':
        this.light = new THREE.DirectionalLight(color, this._intensity)
        this.light.position.set(0, 10, 0)
        break
      case 'point':
        this.light = new THREE.PointLight(color, this._intensity, this._distance, this._decay)
        break
      case 'spot':
        this.light = new THREE.SpotLight(color, this._intensity, this._distance, this._angle, this._penumbra, this._decay)
        this.light.position.set(0, 10, 0)
        this.light.target.position.set(0, 0, 0)
        break
      default:
        this.light = new THREE.PointLight(color, this._intensity, this._distance, this._decay)
    }

    this.light.castShadow = this._castShadow

    if (this._type === 'directional' || this._type === 'spot') {
      this.add(this.light.target)
    }

    this.ctx.world.stage.scene.add(this.light)

    this.updateLightPosition()
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.unmount()
      this.mount()
      return
    }
    if (didMove && this.light) {
      this.updateLightPosition()
    }
  }

  updateLightPosition() {
    if (!this.light) return

    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    this.matrixWorld.decompose(pos, quat, scale)

    this.light.position.copy(pos)

    if (this._type === 'directional' || this._type === 'spot') {
      const dir = new THREE.Vector3(0, -1, 0)
      dir.applyQuaternion(quat)
      this.light.target.position.copy(pos).add(dir)
      this.light.target.updateMatrixWorld()
    }
  }

  unmount() {
    if (this.light) {
      this.ctx.world.stage.scene.remove(this.light)
      this.light.dispose()
      this.light = null
    }
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._type = source._type
    this._color = source._color
    this._intensity = source._intensity
    this._distance = source._distance
    this._decay = source._decay
    this._angle = source._angle
    this._penumbra = source._penumbra
    this._castShadow = source._castShadow
    return this
  }

  get type() {
    return this._type
  }

  set type(value = defaults.type) {
    if (!isType(value)) {
      throw new Error('[light] type invalid, must be: directional, point, spot')
    }
    if (this._type === value) return
    this._type = value
    this.needsRebuild = true
    this.setDirty()
  }

  get color() {
    return this._color
  }

  set color(value = defaults.color) {
    if (!isString(value)) {
      throw new Error('[light] color not a string')
    }
    if (this._color === value) return
    this._color = value
    if (this.light) {
      this.light.color.set(value)
    }
  }

  get intensity() {
    return this._intensity
  }

  set intensity(value = defaults.intensity) {
    if (!isNumber(value)) {
      throw new Error('[light] intensity not a number')
    }
    if (this._intensity === value) return
    this._intensity = value
    if (this.light) {
      this.light.intensity = value
    }
  }

  get distance() {
    return this._distance
  }

  set distance(value = defaults.distance) {
    if (!isNumber(value)) {
      throw new Error('[light] distance not a number')
    }
    if (this._distance === value) return
    this._distance = value
    if (this.light && (this._type === 'point' || this._type === 'spot')) {
      this.light.distance = value
    }
    this.needsRebuild = true
    this.setDirty()
  }

  get decay() {
    return this._decay
  }

  set decay(value = defaults.decay) {
    if (!isNumber(value)) {
      throw new Error('[light] decay not a number')
    }
    if (this._decay === value) return
    this._decay = value
    if (this.light && (this._type === 'point' || this._type === 'spot')) {
      this.light.decay = value
    }
    this.needsRebuild = true
    this.setDirty()
  }

  get angle() {
    return this._angle
  }

  set angle(value = defaults.angle) {
    if (!isNumber(value)) {
      throw new Error('[light] angle not a number')
    }
    if (this._angle === value) return
    this._angle = value
    if (this.light && this._type === 'spot') {
      this.light.angle = value
    }
    this.needsRebuild = true
    this.setDirty()
  }

  get penumbra() {
    return this._penumbra
  }

  set penumbra(value = defaults.penumbra) {
    if (!isNumber(value)) {
      throw new Error('[light] penumbra not a number')
    }
    if (this._penumbra === value) return
    this._penumbra = value
    if (this.light && this._type === 'spot') {
      this.light.penumbra = value
    }
    this.needsRebuild = true
    this.setDirty()
  }

  get castShadow() {
    return this._castShadow
  }

  set castShadow(value = defaults.castShadow) {
    if (typeof value !== 'boolean') {
      throw new Error('[light] castShadow not a boolean')
    }
    if (this._castShadow === value) return
    this._castShadow = value
    this.needsRebuild = true
    this.setDirty()
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get type() {
          return self.type
        },
        set type(value) {
          self.type = value
        },
        get color() {
          return self.color
        },
        set color(value) {
          self.color = value
        },
        get intensity() {
          return self.intensity
        },
        set intensity(value) {
          self.intensity = value
        },
        get distance() {
          return self.distance
        },
        set distance(value) {
          self.distance = value
        },
        get decay() {
          return self.decay
        },
        set decay(value) {
          self.decay = value
        },
        get angle() {
          return self.angle
        },
        set angle(value) {
          self.angle = value
        },
        get penumbra() {
          return self.penumbra
        },
        set penumbra(value) {
          self.penumbra = value
        },
        get castShadow() {
          return self.castShadow
        },
        set castShadow(value) {
          self.castShadow = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy()))
      this.proxy = proxy
    }
    return this.proxy
  }
}

function isType(value) {
  return types.includes(value)
}
