import type { WorldPlugin } from './index.plugins.d.ts'

export declare class LODs {
  constructor(world: any)
  nodes: any[]
  register(node: any): void
  unregister(node: any): void
  destroy(): void
}

export declare const lodsClientPlugin: WorldPlugin
