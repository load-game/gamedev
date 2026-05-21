import { definePlugin } from '../plugins.js'

import { Settings } from '../systems/Settings.js'
import { Apps } from '../systems/Apps.js'
import { Anchors } from '../systems/Anchors.js'
import { Avatars } from '../systems/Avatars.js'
import { Animation } from '../systems/Animation.js'
import { Events } from '../systems/Events.js'
import { Blueprints } from '../systems/Blueprints.js'
import { Entities } from '../systems/Entities.js'
import { Physics } from '../systems/Physics.js'
import { Stage } from '../systems/Stage.js'
import { Scripts } from '../systems/Scripts.js'
import { Logs } from '../systems/Logs.js'

export const coreSystemsPlugin = definePlugin({
  name: '@gamedev/core/systems',
  provides: ['core'],
  systems: [
    ['settings', Settings],
    ['apps', Apps],
    ['anchors', Anchors],
    ['avatars', Avatars],
    ['animation', Animation],
    ['events', Events],
    ['scripts', Scripts],
    ['blueprints', Blueprints],
    ['entities', Entities],
    ['physics', Physics],
    ['stage', Stage],
    ['logs', Logs],
  ],
})
