import type { WorldPlugin } from './index.plugins.d.ts'

export declare class Wind {
  constructor(world: any)
  uniforms: Record<string, { value: any }>
}

export declare const windClientPlugin: WorldPlugin
