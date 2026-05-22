import { definePlugin } from '../../core/plugins.js'
import { AdminClient, ADMIN_SHUTDOWN_COMMAND, RUNTIME_CREDENTIAL_COMMAND } from './AdminClient.js'

export { AdminClient, ADMIN_SHUTDOWN_COMMAND, RUNTIME_CREDENTIAL_COMMAND }

export const adminClientPlugin = definePlugin({
  name: '@gamedev/plugin-admin/client',
  requires: ['core', 'client', 'network'],
  provides: ['@gamedev/plugin-admin', 'admin'],
  systems: [['admin', AdminClient]],
})
