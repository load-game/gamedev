import './index.plugin-animation.d.ts'
import './index.plugin-browser-client.d.ts'
import './index.plugin-controls-client.d.ts'
import './index.plugin-entities-app.d.ts'
import './index.plugin-loader-client.d.ts'
import './index.plugin-loader-client-handlers.d.ts'
import './index.plugin-nodes.d.ts'
import './index.plugin-runtime-viewer.d.ts'
import './index.plugin-spatial.d.ts'
import './index.plugin-stage.d.ts'
import './index.plugin-view.d.ts'
import type { WorldPlugin, WorldPreset } from './index.plugins.d.ts'

export declare const viewerRuntimePlugin: WorldPlugin
export declare const viewerPreset: WorldPreset
export declare function createViewerWorld(options?: { plugins?: any }): any
