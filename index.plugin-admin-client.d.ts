import type { WorldPlugin } from './index.plugins.d.ts'

export declare class AdminClient {
  constructor(world: any)
}

export declare const RUNTIME_CREDENTIAL_COMMAND: 'runtime_credentials_get'
export declare const ADMIN_SHUTDOWN_COMMAND: 'agones_shutdown'

export declare const adminClientPlugin: WorldPlugin
