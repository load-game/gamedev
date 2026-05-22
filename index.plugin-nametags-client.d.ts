import type { WorldPlugin } from './index.plugins.d.ts'

export declare class Nametags {
  constructor(world: any)
  add(options: { name: string; health: number }): any
  remove(nametag: any): void
  destroy(): void
}

export declare const nametagsClientPlugin: WorldPlugin
