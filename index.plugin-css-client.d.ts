import type { WorldPlugin } from './index.plugins.d.ts'

export declare class ClientCSS {
  constructor(world: any)
  scene: any
  renderer: any
  elem: any
  add(object: any): void
  remove(object: any): void
  render(): void
}

export declare const cssClientPlugin: WorldPlugin
