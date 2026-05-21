import type { WorldPlugin } from './index.plugins.d.ts'

export declare class ClientGraphics {
  constructor(world: any)
  viewport: HTMLElement
  width: number
  height: number
  aspect: number
  renderer: any
  composer: any
  maxAnisotropy: number
  worldToScreenFactor: number
  render(): void
  resize(width: number, height: number): void
}

export declare const graphicsClientPlugin: WorldPlugin
