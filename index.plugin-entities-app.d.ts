import 'gamedev'
import type { WorldPlugin } from './index.plugins.d.ts'

export declare class App {
  constructor(world: any, data: any, local?: boolean)
}

export declare const appEntityScriptApi: {
  app: {
    asset: {
      call(entity: any, relativePath: string): string
    }
  }
}

export declare const appEntityPlugin: WorldPlugin

declare module 'gamedev' {
  interface AppAPI {
    asset(relativePath: string): string
  }
}
