import 'gamedev'
import type { WorldPlugin } from './index.plugins.d.ts'

export interface LiveKitStatus {
  available: boolean
  connected: boolean
  connecting?: boolean
  mic: boolean
  screenshare: string | null
  level: LiveKitVoiceLevel
  muted: boolean
}

export type LiveKitVoiceLevel = 'disabled' | 'spatial' | 'global' | null

export declare class ClientLiveKit {
  constructor(world: any)
  status: LiveKitStatus
  deserialize(options?: any): Promise<void>
  connect(): Promise<void> | undefined
  disconnect(): void
  isMuted(playerId: string): boolean
  setMuted(playerId: string, muted: boolean): void
  setLevel(playerId: string, level: LiveKitVoiceLevel): void
  setMicrophoneEnabled(value?: boolean): Promise<void>
  setScreenShareTarget(targetId?: string | null): Promise<void>
  setToken(token: string): Promise<void>
  registerScreenNode(node: any): any
  unregisterScreenNode(node: any): void
}

export declare const livekitClientScriptApi: {
  player: {
    screenshare: {
      call(player: any, targetId: string): void
      meta: {
        summary: string
        docs: string
        environment: 'client'
      }
    }
  }
}

export declare const livekitClientPlugin: WorldPlugin

declare module 'gamedev' {
  interface Player {
    screenshare(screenId: string): void
  }
}
