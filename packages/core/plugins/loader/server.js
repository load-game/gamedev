import { definePlugin } from '../../plugins.js'
import { ServerLoader } from './ServerLoader.js'
import { loaderScriptApi } from './scriptApi.js'

export { ServerLoader, loaderScriptApi }

export const loaderServerPlugin = definePlugin({
  name: '@gamedev/plugin-loader/server',
  requires: ['core'],
  provides: ['@gamedev/plugin-loader', 'loader'],
  systems: [['loader', ServerLoader]],
  scripts: loaderScriptApi,
})
