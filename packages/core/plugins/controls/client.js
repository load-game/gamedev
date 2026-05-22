import { definePlugin } from '../../plugins.js'
import { ControlPriorities } from '../../extras/ControlPriorities.js'
import { ClientControls } from './ClientControls.js'

export { ClientControls }

export const controlsClientScriptApi = {
  app: {
    control(entity, options) {
      entity.control?.release()
      // TODO: only allow on user interaction
      // TODO: show UI with a button to release()
      entity.control = entity.world.controls.bind({
        ...options,
        priority: ControlPriorities.APP,
        object: entity,
      })
      return entity.control
    },
  },
}

export const controlsClientPlugin = definePlugin({
  name: '@gamedev/plugin-controls/client',
  requires: ['core', 'view'],
  provides: ['@gamedev/plugin-controls', 'controls'],
  systems: [['controls', ClientControls]],
  scripts: controlsClientScriptApi,
})
