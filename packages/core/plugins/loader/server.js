import { definePlugin } from '../../plugins.js'
import { ServerLoader, serverLoaderHandlers } from './ServerLoader.js'
import { loaderScriptApi } from './scriptApi.js'

export { ServerLoader, serverLoaderHandlers, loaderScriptApi }

export const loaderServerPlugin = definePlugin({
  name: '@gamedev/plugin-loader/server',
  requires: ['core', 'nodes'],
  provides: ['@gamedev/plugin-loader', 'loader'],
  systems: [['loader', ServerLoader]],
  loaders: serverLoaderHandlers,
  scripts: loaderScriptApi,
})
