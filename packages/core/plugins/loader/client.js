import { definePlugin } from '../../plugins.js'
import { ClientLoader, clientLoaderHandlers } from './ClientLoader.js'
import { loaderScriptApi } from './scriptApi.js'

export { ClientLoader, clientLoaderHandlers, loaderScriptApi }

export const loaderClientPlugin = definePlugin({
  name: '@gamedev/plugin-loader/client',
  requires: ['core', 'client', 'nodes', 'stage'],
  provides: ['@gamedev/plugin-loader', 'loader'],
  systems: [['loader', ClientLoader]],
  loaders: clientLoaderHandlers,
  scripts: loaderScriptApi,
})
