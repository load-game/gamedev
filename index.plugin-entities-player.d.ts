import type { WorldPlugin } from './index.plugins.d.ts'

export declare class AdminPlayerRemote {
  constructor(world: any, data: any, local?: boolean)
}

export declare class PlayerLocal {
  constructor(world: any, data: any, local?: boolean)
}

export declare class PlayerRemote {
  constructor(world: any, data: any, local?: boolean)
}

export declare const playerEntitiesPlugin: WorldPlugin
