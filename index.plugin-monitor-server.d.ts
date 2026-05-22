import type { WorldPlugin } from './index.plugins.d.ts'

export declare class ServerMonitor {
  constructor(world: any)
  getStats(): Promise<{
    maxMemory: number
    currentMemory: number
    maxCPU: number
    currentCPU: number
  }>
}

export declare const monitorServerPlugin: WorldPlugin
