import { definePlugin } from '../../plugins.js'
import { ClientBuilder } from './ClientBuilder.js'
import { ClientDrafts } from './ClientDrafts.js'

export { ClientBuilder, ClientDrafts }

export const builderClientPlugin = definePlugin({
  name: '@gamedev/plugin-builder/client',
  requires: [
    'core',
    'client',
    'network',
    'controls',
    'ui',
    'loader',
    'admin',
    'nodes',
    'entity:app',
    'snaps',
    'stage',
    'view',
  ],
  provides: ['@gamedev/plugin-builder', 'builder', 'drafts'],
  systems: [
    ['builder', ClientBuilder],
    ['drafts', ClientDrafts],
  ],
})
