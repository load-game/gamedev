import 'gamedev'
import type { LoaderScriptResult, LoaderScriptType } from 'gamedev'
import type { LoaderHandler, WorldPlugin } from './index.plugins.d.ts'

export declare class ServerLoader {
  constructor(world: any)
  has(type: string, url: string): boolean
  get<T = any>(type: string, url: string): T | undefined
  preload(type: string, url: string): void
  execPreload(): void
  register(type: string, load: LoaderHandler<this>, options?: { plugin?: string | null }): void
  fetchArrayBuffer(url: string): Promise<ArrayBuffer>
  fetchText(url: string): Promise<string>
  load<T = any>(type: string, url: string): Promise<T>
  destroy(): void
}

export declare const loaderScriptApi: {
  world: {
    load<T extends LoaderScriptType>(entity: any, type: T, url: string): Promise<LoaderScriptResult<T>>
  }
}

export declare const loaderServerPlugin: WorldPlugin

declare module 'gamedev' {
  interface WorldAPI {
    load<T extends LoaderScriptType>(type: T, url: string): Promise<LoaderScriptResult<T>>
  }
}
