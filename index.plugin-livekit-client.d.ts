import type { WorldPlugin } from './index.plugins.d.ts'

export interface LiveKitStatus {
  available: boolean
  connected: boolean
  connecting?: boolean
  mic: boolean
  screenshare: string | null
  level: 'disabled' | 'spatial' | 'global' | null
  muted: boolean
}

export declare class ClientLiveKit {
  constructor(world: any)
  status: LiveKitStatus
  deserialize(options?: any): Promise<void>
  connect(): Promise<void> | undefined
  disconnect(): void
  isMuted(playerId: string): boolean
  setMuted(playerId: string, muted: boolean): void
  setLevel(playerId: string, level: LiveKitStatus['level']): void
  setMicrophoneEnabled(value?: boolean): Promise<void>
  setScreenShareTarget(targetId?: string | null): Promise<void>
  setToken(token: string): Promise<void>
  registerScreenNode(node: any): any
  unregisterScreenNode(node: any): void
}

export declare const livekitClientPlugin: WorldPlugin
