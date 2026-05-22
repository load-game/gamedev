import 'gamedev'
import type { WorldPlugin } from './index.plugins.d.ts'

export declare class AdminNetwork {
  constructor(world: any)
  id: string
  adminUrl: string | null
  connected: boolean
  authenticated: boolean
  error: string | null
  isClient: true
  maxUploadSize: number | null
  connect(): void
  disconnect(): void
  setCode(code: string | null): void
  setSubscriptions(subscriptions: any): void
  send(): void
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

export declare const networkAdminPlugin: WorldPlugin

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
