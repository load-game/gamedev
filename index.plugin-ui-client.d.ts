import 'gamedev'
import type { WorldPlugin } from './index.plugins.d.ts'

export interface ReticleOptions {
  type?: string
  image?: string | null
  color?: string
  size?: number
  [key: string]: unknown
}

export declare class ClientUI {
  constructor(world: any)
}

export declare const uiClientScriptApi: {
  world: {
    setReticle(entity: any, options: ReticleOptions | null): void
  }
}

export declare const uiClientPlugin: WorldPlugin

declare module 'gamedev' {
  interface WorldAPI {
    setReticle(options: ReticleOptions | null): void
  }
}
