import 'gamedev'
import type { WorldPlugin } from './index.plugins.d.ts'

export type LiveKitVoiceLevel = 'disabled' | 'spatial' | 'global' | null

export declare class ServerLiveKit {
  constructor(world: any)
  enabled: boolean
  generateToken(playerId: string): Promise<string | null>
  serialize(playerId: string): Promise<any>
  removeParticipant(playerId: string): Promise<void>
  setMuted(playerId: string, muted: boolean): void
  addModifier(playerId: string, level: LiveKitVoiceLevel): any
  updateModifier(modifier: any, level: LiveKitVoiceLevel): any
  removeModifier(modifier: any): null
  clearModifiers(playerId: string): void
}

export declare const livekitServerScriptApi: {
  player: {
    setVoiceLevel: {
      call(player: any, level: LiveKitVoiceLevel): void
      meta: {
        summary: string
        docs: string
        environment: 'server'
      }
    }
  }
}

export declare function cleanupLiveKitPlayerProxy(entity: any, player: any): void

export declare const livekitServerPlugin: WorldPlugin

declare module 'gamedev' {
  interface Player {
    setVoiceLevel(level: LiveKitVoiceLevel): void
  }
}
