import { definePlugin } from '../../plugins.js'
import { ServerEnvironment } from './ServerEnvironment.js'
import { installEnvironmentMaterialApi } from './material.js'

export { ServerEnvironment }

export const environmentServerPlugin = definePlugin({
  name: '@gamedev/plugin-environment/server',
  requires: ['core', 'server'],
  provides: ['@gamedev/plugin-environment', 'environment'],
  systems: [['environment', ServerEnvironment]],
  setup: installEnvironmentMaterialApi,
})
