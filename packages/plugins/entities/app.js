import { definePlugin } from '../../core/plugins.js'
import { App } from './App.js'
import { appEntityScriptApi } from './appScriptApi.js'

export { App }
export { appEntityScriptApi }

export const appEntityPlugin = definePlugin({
  name: '@gamedev/plugin-entities/app',
  requires: [
    'core',
    'apps',
    'blueprints',
    'entities',
    'scripts',
    'nodes',
    'loader',
    'loader:model',
    'loader:avatar',
    'loader:script',
  ],
  provides: ['app-entity'],
  entities: {
    app: App,
  },
  scripts: appEntityScriptApi,
})
