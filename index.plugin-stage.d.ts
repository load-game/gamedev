import type { WorldPlugin } from './index.plugins.d.ts'

export declare class Stage {
  constructor(world: any)
  scene: any
  octree: any
  models: Map<string, any>
  insert(options: any): any
  createMaterial(options?: any): any
  raycastPointer(position: { x: number; y: number }, layers?: any, min?: number, max?: number): any[]
  raycastReticle(layers?: any, min?: number, max?: number): any[]
  raycast(origin: any, direction: any, layers?: any, min?: number, max?: number): any[]
}

export declare const stagePlugin: WorldPlugin
