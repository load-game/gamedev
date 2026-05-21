import type { WorldPlugin } from './index.plugins.d.ts'

export declare class AdminXR {
  constructor(world: any)
  session: null
  camera: any
  supportsVR: false
  supportsAR: false
  enter(): Promise<false>
}

export declare const xrAdminPlugin: WorldPlugin
