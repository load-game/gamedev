import 'gamedev'
import type { BaseNode } from 'gamedev'
import type { LoaderHandler, WorldPlugin } from './index.plugins.d.ts'
import type { ServerLoader } from './index.plugin-loader-server.d.ts'

export declare const serverLoaderHandlers: Readonly<Record<string, LoaderHandler<ServerLoader>>>
export declare const loaderServerHandlersPlugin: WorldPlugin

declare module 'gamedev' {
  interface LoaderScriptResultRegistry {
    avatar: BaseNode
    model: BaseNode
  }
}
