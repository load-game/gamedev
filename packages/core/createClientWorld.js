import { World } from './World.js'

import { Client } from './systems/Client.js'
import { ClientLiveKit } from './systems/ClientLiveKit.js'
import { ClientPointer } from './systems/ClientPointer.js'
import { ClientPrefs } from './systems/ClientPrefs.js'
import { ClientControls } from './systems/ClientControls.js'
import { ClientNetwork } from './systems/ClientNetwork.js'
import { AdminClient } from './systems/AdminClient.js'
import { ClientLoader } from './systems/ClientLoader.js'
import { ClientCSS } from './systems/ClientCSS.js'
import { ClientGraphics } from './systems/ClientGraphics.js'
import { ClientEnvironment } from './systems/ClientEnvironment.js'
import { ClientAudio } from './systems/ClientAudio.js'
import { ClientStats } from './systems/ClientStats.js'
import { ClientBuilder } from './systems/ClientBuilder.js'
import { ClientActions } from './systems/ClientActions.js'
import { ClientTarget } from './systems/ClientTarget.js'
import { ClientUI } from './systems/ClientUI.js'
import { ClientAI } from './systems/ClientAI.js'
import { ClientDrafts } from './systems/ClientDrafts.js'
import { LODs } from './systems/LODs.js'
import { Nametags } from './systems/Nametags.js'
import { Particles } from './systems/Particles.js'
import { Snaps } from './systems/Snaps.js'
import { Wind } from './systems/Wind.js'
import { XR } from './systems/XR.js'

export function createClientWorld({ configure } = {}) {
  const world = new World()
  world.register('client', Client)
  world.register('livekit', ClientLiveKit)
  world.register('pointer', ClientPointer)
  world.register('prefs', ClientPrefs)
  world.register('controls', ClientControls)
  world.register('network', ClientNetwork)
  world.register('admin', AdminClient)
  world.register('loader', ClientLoader)
  world.register('css', ClientCSS)
  world.register('graphics', ClientGraphics)
  world.register('environment', ClientEnvironment)
  world.register('audio', ClientAudio)
  world.register('stats', ClientStats)
  world.register('builder', ClientBuilder)
  world.register('actions', ClientActions)
  world.register('target', ClientTarget)
  world.register('ui', ClientUI)
  world.register('ai', ClientAI)
  world.register('drafts', ClientDrafts)
  world.register('lods', LODs)
  world.register('nametags', Nametags)
  world.register('particles', Particles)
  world.register('snaps', Snaps)
  world.register('wind', Wind)
  world.register('xr', XR)
  configure?.(world)
  return world
}
