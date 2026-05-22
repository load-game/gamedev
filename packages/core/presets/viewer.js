import { definePlugin, definePreset } from '../plugins.js'
import { coreSystemsPlugin } from './core.js'
import { animationPlugin } from '../plugins/animation.js'
import { browserClientPlugin } from '../plugins/browser/client.js'
import { controlsClientPlugin } from '../plugins/controls/client.js'
import { environmentClientPlugin } from '../plugins/environment/client.js'
import { appEntityPlugin } from '../plugins/entities/app.js'
import { graphicsClientPlugin } from '../plugins/graphics/client.js'
import { loaderClientPlugin } from '../plugins/loader/client.js'
import { logsPlugin } from '../plugins/logs.js'
import { nodesPlugin } from '../plugins/nodes.js'
import { prefsClientPlugin } from '../plugins/prefs/client.js'
import { spatialPlugin } from '../plugins/spatial.js'
import { stagePlugin } from '../plugins/stage.js'
import { viewPlugin } from '../plugins/view.js'
import { Client } from '../systems/Client.js'

export const viewerRuntimePlugin = definePlugin({
  name: '@gamedev/viewer/runtime',
  requires: ['core', 'graphics', 'controls'],
  systems: [['client', Client]],
})

export const viewerPreset = definePreset({
  name: '@gamedev/preset-viewer',
  plugins: [
    coreSystemsPlugin,
    logsPlugin,
    nodesPlugin,
    viewPlugin,
    animationPlugin,
    spatialPlugin,
    stagePlugin,
    prefsClientPlugin,
    graphicsClientPlugin,
    controlsClientPlugin,
    viewerRuntimePlugin,
    browserClientPlugin,
    loaderClientPlugin,
    appEntityPlugin,
    environmentClientPlugin,
  ],
})
