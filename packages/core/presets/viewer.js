import { definePreset } from '../plugins.js'
import { createWorldFromPreset } from './createWorld.js'
import { coreSystemsPlugin } from './core.js'
import { animationPlugin } from '../../plugins/animation.js'
import { browserClientPlugin } from '../../plugins/browser/client.js'
import { controlsClientPlugin } from '../../plugins/controls/client.js'
import { environmentClientPlugin } from '../../plugins/environment/client.js'
import { appEntityPlugin } from '../../plugins/entities/app.js'
import { graphicsClientPlugin } from '../../plugins/graphics/client.js'
import { loaderClientPlugin } from '../../plugins/loader/client.js'
import { loaderClientHandlersPlugin } from '../../plugins/loader/client-handlers.js'
import { logsPlugin } from '../../plugins/logs.js'
import { nodesPlugin } from '../../plugins/nodes.js'
import { prefsClientPlugin } from '../../plugins/prefs/client.js'
import { spatialPlugin } from '../plugins/spatial.js'
import { stagePlugin } from '../../plugins/stage.js'
import { viewPlugin } from '../../plugins/view.js'
import { viewerRuntimePlugin } from '../../plugins/runtime/viewer.js'

export { viewerRuntimePlugin }

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
    loaderClientHandlersPlugin,
    appEntityPlugin,
    environmentClientPlugin,
  ],
})

export function createViewerWorld(options = {}) {
  return createWorldFromPreset(viewerPreset, options)
}
