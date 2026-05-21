import { definePlugin } from '../../plugins.js'
import { ClientUI } from './ClientUI.js'

export { ClientUI }

export const uiClientScriptApi = Object.freeze({
  world: Object.freeze({
    setReticle(entity, options) {
      entity.world.ui.setReticle(options)
    },
  }),
})

export const uiClientPlugin = definePlugin({
  name: '@gamedev/plugin-ui/client',
  requires: ['core', 'chat', 'client', 'controls', 'prefs'],
  provides: ['@gamedev/plugin-ui', 'ui'],
  systems: [['ui', ClientUI]],
  scripts: uiClientScriptApi,
})
