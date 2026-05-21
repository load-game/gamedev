import type { WorldPlugin } from './index.plugins.d.ts'
import type { LiveKitStatus } from './index.plugin-livekit-client.d.ts'

export declare class ServerLiveKit {
  constructor(world: any)
  enabled: boolean
  generateToken(playerId: string): Promise<string | null>
  serialize(playerId: string): Promise<any>
  removeParticipant(playerId: string): Promise<void>
  setMuted(playerId: string, muted: boolean): void
  addModifier(playerId: string, level: LiveKitStatus['level']): any
  updateModifier(modifier: any, level: LiveKitStatus['level']): any
  removeModifier(modifier: any): null
  clearModifiers(playerId: string): void
}

export declare const livekitServerPlugin: WorldPlugin
