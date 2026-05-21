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

export declare const networkClientPlugin: WorldPlugin
