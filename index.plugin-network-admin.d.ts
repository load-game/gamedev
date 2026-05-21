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

export declare const networkAdminPlugin: WorldPlugin
