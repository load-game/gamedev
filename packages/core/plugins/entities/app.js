import { definePlugin } from '../../plugins.js'
import { App } from '../../entities/App.js'

export { App }

export const appEntityPlugin = definePlugin({
  name: '@gamedev/plugin-entities/app',
  requires: ['core', 'apps', 'blueprints', 'entities', 'scripts', 'nodes', 'loader'],
  provides: ['app-entity'],
  entities: {
    app: App,
  },
})
