import type { WorldPlugin } from './index.plugins.d.ts'

export declare class XR {
  constructor(world: any)
  session: any
  camera: any
  supportsVR: boolean
  supportsAR: boolean
  enter(): Promise<void>
}

export declare const xrClientPlugin: WorldPlugin
