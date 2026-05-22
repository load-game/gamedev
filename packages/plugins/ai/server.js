import { definePlugin } from '../../core/plugins.js'
import { ServerAI } from './ServerAI.js'
import { ServerAIScripts } from './ServerAIScripts.js'

export { ServerAI, ServerAIScripts }

export const aiServerPlugin = definePlugin({
  name: '@gamedev/plugin-ai/server',
  requires: ['core', 'server', 'network', 'loader', 'blueprints'],
  provides: ['@gamedev/plugin-ai', 'ai', 'aiScripts'],
  systems: [
    ['ai', ServerAI],
    ['aiScripts', ServerAIScripts],
  ],
})
