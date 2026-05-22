import 'ses'
import '@gamedev/core/lockdown.js'
import path from 'path'
import { fileURLToPath } from 'url'

// support `__dirname` in ESM
globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url))

export { createNodeClientWorld } from '@gamedev/core/createNodeClientWorld.js'
export { System } from '@gamedev/core/systems/System.js'
export { storage } from '@gamedev/core/plugins/storage/local.js'
