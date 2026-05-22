import type { WorldPlugin } from './index.plugins.d.ts'

export declare class AdminLocalPlayer {
  constructor(world: any, data?: { id?: string; name?: string })
}

export declare class AdminPlayerRemote {
  constructor(world: any, data: any, local?: boolean)
}

export declare class FreeCam {
  constructor(world: any)
}

export declare function createAdminPlayerEntity(world: any, data: any, local?: boolean): AdminPlayerRemote

export declare const adminPlayerEntitiesPlugin: WorldPlugin
