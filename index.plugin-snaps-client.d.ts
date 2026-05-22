import type { WorldPlugin } from './index.plugins.d.ts'

export declare class Snaps {
  constructor(world: any)
  octree: any
  create(
    position: any,
    active: boolean
  ): {
    move(): void
    destroy(): void
  }
}

export declare const snapsClientPlugin: WorldPlugin
