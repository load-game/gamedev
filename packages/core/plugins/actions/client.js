import { definePlugin } from '../../plugins.js'
import { ClientActions } from './ClientActions.js'

export { ClientActions }

export const actionsClientPlugin = definePlugin({
  name: '@gamedev/plugin-actions/client',
  requires: ['core', 'client', 'controls', 'graphics'],
  provides: ['@gamedev/plugin-actions', 'actions'],
  systems: [['actions', ClientActions]],
})
