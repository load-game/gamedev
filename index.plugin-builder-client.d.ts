import type { WorldPlugin } from './index.plugins.d.ts'

export declare class ClientBuilder {
  constructor(world: any)
}

export declare class ClientDrafts {
  constructor(world: any)
  createDraftApp(input: string | { name?: string; props?: Record<string, unknown> }): Promise<{
    blueprintId: string
    appId: string
  }>
}

export declare const builderClientPlugin: WorldPlugin
