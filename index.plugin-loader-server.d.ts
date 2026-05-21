import 'gamedev'
import type { BaseNode } from 'gamedev'
import type { LoaderHandler, WorldPlugin } from './index.plugins.d.ts'

export type LoaderScriptType = 'avatar' | 'model' | 'splat'

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

export declare const serverLoaderHandlers: Readonly<Record<string, LoaderHandler<ServerLoader>>>

export declare const loaderScriptApi: {
  world: {
    load(entity: any, type: LoaderScriptType, url: string): Promise<BaseNode>
  }
}

export declare const loaderServerPlugin: WorldPlugin

declare module 'gamedev' {
  interface WorldAPI {
    load(type: LoaderScriptType, url: string): Promise<BaseNode>
  }
}
