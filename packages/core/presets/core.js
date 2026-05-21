import { definePlugin } from '../plugins.js'

import { Settings } from '../systems/Settings.js'
import { Apps } from '../systems/Apps.js'
import { Events } from '../systems/Events.js'
import { Blueprints } from '../systems/Blueprints.js'
import { Entities } from '../systems/Entities.js'
import { Scripts } from '../systems/Scripts.js'

const coreScriptApiCapabilities = [
  'script:world.add',
  'script:world.remove',
  'script:world.attach',
  'script:world.on',
  'script:world.off',
  'script:world.emit',
  'script:world.getTimestamp',
  'script:world.getPlayer',
  'script:world.getPlayers',
  'script:app.instanceId',
  'script:app.version',
  'script:app.modelUrl',
  'script:app.state',
  'script:app.props',
  'script:app.config',
  'script:app.resetOnMove',
  'script:app.isMoving',
  'script:app.on',
  'script:app.off',
  'script:app.emit',
  'script:app.create',
  'script:app.control',
  'script:app.configure',
]

export const coreSystemsPlugin = definePlugin({
  name: '@gamedev/core/systems',
  provides: ['core', ...coreScriptApiCapabilities],
  systems: [
    ['settings', Settings],
    ['apps', Apps],
    ['events', Events],
    ['scripts', Scripts],
    ['blueprints', Blueprints],
    ['entities', Entities],
  ],
})
