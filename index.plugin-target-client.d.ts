import type { WorldPlugin } from './index.plugins.d.ts'

export declare class ClientTarget {
  constructor(world: any)
  target: any | null
  show(vec3: any): void
  hide(): void
  destroy(): void
}

export declare const targetClientPlugin: WorldPlugin
