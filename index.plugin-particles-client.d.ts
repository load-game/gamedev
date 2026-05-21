import type { WorldPlugin } from './index.plugins.d.ts'

export declare class Particles {
  constructor(world: any)
  emitters: Map<string, any>
  register(node: any): any
}

export declare const particlesClientPlugin: WorldPlugin
