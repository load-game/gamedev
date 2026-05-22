import 'gamedev'
import type { WorldPlugin } from './index.plugins.d.ts'

export interface ClipboardCopyOptions {
  kind?: 'text' | 'image'
  type?: 'text' | 'image'
}

export declare const browserClientScriptApi: {
  world: {
    open(entity: any, url: string, newWindow?: boolean): void
    copy(entity: any, value: string | { url: string }, options?: ClipboardCopyOptions): Promise<boolean>
    getQueryParam(entity: any, key: string): string | null
    setQueryParam(entity: any, key: string, value?: string | null): void
  }
}

export declare const browserClientPlugin: WorldPlugin

declare module 'gamedev' {
  interface WorldAPI {
    getQueryParam(key: string): string | null
    setQueryParam(key: string, value?: string | null): void
    open(url: string, newTab?: boolean): void
    copy(value: string | { url: string }, options?: ClipboardCopyOptions): Promise<boolean>
  }
}
