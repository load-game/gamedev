import { definePlugin } from '../../plugins.js'
import { ClientLoader } from './ClientLoader.js'
import { loaderScriptApi } from './scriptApi.js'

export { ClientLoader, loaderScriptApi }

export const loaderClientPlugin = definePlugin({
  name: '@gamedev/plugin-loader/client',
  requires: ['core', 'client', 'stage'],
  provides: ['@gamedev/plugin-loader', 'loader'],
  systems: [['loader', ClientLoader]],
  scripts: loaderScriptApi,
})
