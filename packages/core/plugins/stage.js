import { definePlugin } from '../plugins.js'
import { Stage } from './stage/Stage.js'

export { Stage }

export const stagePlugin = definePlugin({
  name: '@gamedev/plugin-stage',
  requires: ['core'],
  provides: ['@gamedev/plugin-stage'],
  systems: [['stage', Stage]],
})
