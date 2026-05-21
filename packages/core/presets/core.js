import { definePlugin } from '../plugins.js'

import { Settings } from '../systems/Settings.js'
import { Apps } from '../systems/Apps.js'
import { Events } from '../systems/Events.js'
import { Blueprints } from '../systems/Blueprints.js'
import { Entities } from '../systems/Entities.js'
import { Scripts } from '../systems/Scripts.js'

export const coreSystemsPlugin = definePlugin({
  name: '@gamedev/core/systems',
  provides: ['core'],
  systems: [
    ['settings', Settings],
    ['apps', Apps],
    ['events', Events],
    ['scripts', Scripts],
    ['blueprints', Blueprints],
    ['entities', Entities],
  ],
})
