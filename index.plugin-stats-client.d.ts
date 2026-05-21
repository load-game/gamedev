import type { WorldPlugin } from './index.plugins.d.ts'

export declare class ClientStats {
  constructor(world: any)
  active: boolean
  init(options: { ui?: HTMLElement }): void
  toggle(value?: boolean): void
  onPong(time: number): void
  destroy(): void
}

export declare const statsClientPlugin: WorldPlugin
