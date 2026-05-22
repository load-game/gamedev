import 'ses'
import '@gamedev/core/lockdown.js'
import path from 'path'
import { fileURLToPath } from 'url'

// support `__dirname` in ESM
globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url))

export { createNodeClientWorld } from '../presets/node-client.js'
export { System } from '@gamedev/core/systems/System.js'
export { storage } from '../plugins/storage/local.js'
