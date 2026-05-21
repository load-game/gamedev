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

export declare const networkServerPlugin: WorldPlugin
