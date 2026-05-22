import { System } from '../../core/systems/System.js'

export class NodeEnvironment extends System {
  constructor(world) {
    super(world)

    this.model = null
    this.skys = []
    this.sky = null
    this.skyN = 0
    this.bgUrl = null
    this.hdrUrl = null
  }

  init({ baseEnvironment }) {
    this.base = baseEnvironment
  }
}
