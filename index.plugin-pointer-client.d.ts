import type { WorldPlugin } from './index.plugins.d.ts'

export declare class ClientPointer {
  constructor(world: any)
  ui: HTMLElement | undefined
  setScreenHit(screenHit: any): void
}

export declare const pointerClientPlugin: WorldPlugin
