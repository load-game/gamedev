import { definePlugin } from '../core/plugins.js'
import * as builtinNodes from './nodes/index.js'

export { builtinNodes }

export const nodesPlugin = definePlugin({
  name: '@gamedev/plugin-nodes',
  requires: ['core'],
  provides: ['@gamedev/plugin-nodes', 'nodes'],
  nodes: builtinNodes,
})
