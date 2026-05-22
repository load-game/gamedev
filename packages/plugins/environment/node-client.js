import { definePlugin } from '../../core/plugins.js'
import { NodeEnvironment } from './NodeEnvironment.js'
import { installEnvironmentMaterialApi } from './material.js'

export { NodeEnvironment }

export const environmentNodeClientPlugin = definePlugin({
  name: '@gamedev/plugin-environment/node-client',
  requires: ['core', 'client'],
  provides: ['@gamedev/plugin-environment', 'environment'],
  systems: [['environment', NodeEnvironment]],
  setup: installEnvironmentMaterialApi,
})
