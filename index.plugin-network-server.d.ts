import 'gamedev'
import type { WorldPlugin } from './index.plugins.d.ts'

export declare class ServerNetwork {
  constructor(world: any)
  id: number
  worldId: string
  isServer: true
  sockets: Map<string, any>
  authMode: string
  usesLobbyIdentity: boolean
  init(options?: any): void
  start(): Promise<void>
  send(name: string, data?: any, ignoreSocketId?: string): void
  sendTo(socketId: string, name: string, data?: any): void
  getTime(): number
  onConnection(ws: any, params: any, req: any): Promise<void>
  destroy(): void
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

export declare const networkServerPlugin: WorldPlugin

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
