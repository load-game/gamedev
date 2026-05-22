import type { WorldPlugin } from './index.plugins.d.ts'
import type { AIProviderState } from './index.plugin-ai-client.d.ts'

export declare class ServerAI {
  constructor(world: any)
  enabled: boolean
  provider: string | null
  model: string | null
  effort: string | null
  serialize(): AIProviderState
  init(options: { assets?: any }): Promise<void>
  handleCreate(socket: any, data: any): Promise<void>
}

export declare class ServerAIScripts {
  constructor(world: any)
  init(options: { assets?: any }): Promise<void>
  handleRequest(socket: any, data: any): Promise<void>
  getBusyStateForBlueprint(blueprint: any): any
}

export declare const aiServerPlugin: WorldPlugin
