import type { WorldPlugin } from './index.plugins.d.ts'
import type { LiveKitStatus } from './index.plugin-livekit-client.d.ts'

export declare class AdminLiveKit {
  constructor(world: any)
  status: LiveKitStatus
  deserialize(options?: any): void
  isMuted(playerId: string): boolean
  setMuted(playerId: string, muted: boolean): void
  setLevel(playerId: string, level: LiveKitStatus['level']): void
  setMicrophoneEnabled(): void
  setScreenShareTarget(): void
}

export declare const livekitAdminPlugin: WorldPlugin
