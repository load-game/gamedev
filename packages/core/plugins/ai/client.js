import { definePlugin } from '../../plugins.js'
import { ClientAI } from './ClientAI.js'
import { ClientAIScripts } from './ClientAIScripts.js'

export { ClientAI, ClientAIScripts }

export const aiClientPlugin = definePlugin({
  name: '@gamedev/plugin-ai/client',
  requires: ['core', 'client', 'network', 'drafts'],
  provides: ['@gamedev/plugin-ai', 'ai'],
  systems: [['ai', ClientAI]],
})
