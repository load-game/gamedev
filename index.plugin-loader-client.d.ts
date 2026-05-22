import 'gamedev'
import type { LoaderScriptResult, LoaderScriptType } from 'gamedev'
import type { LoaderHandler, WorldPlugin } from './index.plugins.d.ts'

export declare class ClientLoader {
  constructor(world: any)
  has(type: string, url: string): boolean
  get<T = any>(type: string, url: string): T | undefined
  preload(type: string, url: string): void
  execPreload(): void
  register(type: string, load: LoaderHandler<this>, options?: { plugin?: string | null }): void
  setFile(url: string, file: File): void
  hasFile(url: string): boolean
  getFile(url: string, name?: string): File | null
  loadFile(url: string): Promise<File>
  load<T = any>(type: string, url: string): Promise<T>
  insert<T = any>(type: string, url: string, file: File): Promise<T>
}

export declare const loaderScriptApi: {
  world: {
    load<T extends LoaderScriptType>(entity: any, type: T, url: string): Promise<LoaderScriptResult<T>>
  }
}

export declare const loaderClientPlugin: WorldPlugin

declare module 'gamedev' {
  interface WorldAPI {
    load<T extends LoaderScriptType>(type: T, url: string): Promise<LoaderScriptResult<T>>
  }
}
