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

export declare class AdminLiveKit {
  constructor(world: any)
  status: LiveKitStatus
  deserialize(options?: any): void
  isMuted(playerId: string): boolean
  setMuted(playerId: string, muted: boolean): void
  setLevel(playerId: string, level: LiveKitVoiceLevel): void
  setMicrophoneEnabled(): void
  setScreenShareTarget(): void
}

export declare const livekitAdminPlugin: WorldPlugin
