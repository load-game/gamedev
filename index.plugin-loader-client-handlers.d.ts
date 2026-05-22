import 'gamedev'
import type { BaseNode } from 'gamedev'
import type { LoaderHandler, WorldPlugin } from './index.plugins.d.ts'
import type { ClientLoader } from './index.plugin-loader-client.d.ts'

export declare const clientLoaderHandlers: Readonly<Record<string, LoaderHandler<ClientLoader>>>
export declare const loaderClientHandlersPlugin: WorldPlugin

declare module 'gamedev' {
  interface LoaderScriptResultRegistry {
    avatar: BaseNode
    model: BaseNode
    splat: BaseNode
  }
}
