import type { WorldPlugin } from './index.plugins.d.ts'

export declare class Logs {
  constructor(world: any)
  entries: Array<{
    id: number
    source: string
    level: string
    args: string[]
    timestamp: number
  }>
  nextId: number
  add(source: string, level: string, args: unknown[]): void
  addBatch(
    source: string,
    items: Array<{
      level: string
      args: string[]
      timestamp: number
    }>
  ): void
  clear(): void
}

export declare const logsPlugin: WorldPlugin
