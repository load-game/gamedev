import type { WorldPlugin } from './index.plugins.d.ts'

export declare class ClientEnvironment {
  constructor(world: any)
  model: any
  skys: any[]
  addSky(node: any): { node: any; destroy(): void }
  updateSky(): Promise<void>
}

export declare const environmentClientPlugin: WorldPlugin
