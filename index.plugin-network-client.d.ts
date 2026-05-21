import 'gamedev'
import type { WorldPlugin } from './index.plugins.d.ts'

export declare class ClientNetwork {
  constructor(world: any)
  id: string | null
  apiUrl: string | null
  wsUrl: string | null
  isClient: true
  isOffline: boolean
  maxUploadSize: number | null
  connect(): void
  send(name: string, data?: any): void
  upload(file: File): Promise<void>
  getTime(): number
}

export declare const networkScriptApi: {
  world: {
    networkId: { get(entity: any): string | number | null }
    isServer: { get(entity: any): boolean }
    isClient: { get(entity: any): boolean }
    getTime(entity: any): number
  }
  app: {
    send(entity: any, name: string, data?: any, ignoreSocketId?: string | boolean): void
    sendTo(entity: any, playerId: string, name: string, data?: any): void
  }
}

export declare const networkClientPlugin: WorldPlugin

declare module 'gamedev' {
  interface WorldAPI {
    readonly networkId: string | number | null
    readonly isServer: boolean
    readonly isClient: boolean
    getTime(): number
  }

  interface AppAPI {
    send(name: string, data?: any, ignoreSocketId?: string | boolean): void
    sendTo(playerId: string, name: string, data?: any): void
  }
}
