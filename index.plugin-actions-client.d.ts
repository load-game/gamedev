import type { WorldPlugin } from './index.plugins.d.ts'

export declare class ClientActions {
  constructor(world: any)
  current: {
    node: any | null
    distance: number
  }
  btnDown: boolean
  register(node: any): void
  unregister(node: any): void
  on(event: 'change', callback: (active: boolean) => void): this
  off(event: 'change', callback: (active: boolean) => void): this
  destroy(): void
}

export declare const actionsClientPlugin: WorldPlugin
