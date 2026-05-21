import type { WorldPlugin } from './index.plugins.d.ts'

export declare class ClientControls {
  constructor(world: any)
  actions: any[]
  pointer: {
    locked: boolean
    shouldLock: boolean
    coords: any
    position: any
    delta: any
  }
  bind(options?: any): any
  releaseAllButtons(): void
  setTouchBtn(prop: string, down: boolean): void
  simulateButton(prop: string, pressed: boolean): void
  lockPointer(): Promise<boolean | undefined>
  unlockPointer(): void
}

export declare const controlsClientPlugin: WorldPlugin
