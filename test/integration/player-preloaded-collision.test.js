import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from '../../packages/core/extras/three.js'
import { App } from '../../packages/core/entities/App.js'
import { PlayerLocal } from '../../packages/core/entities/PlayerLocal.js'

vi.mock('../../packages/core/extras/createNode.js', async () => {
  const THREE = await import('../../packages/core/extras/three.js')
  return {
    createNode: () => ({
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1),
      add: vi.fn(),
      activate: vi.fn(),
      deactivate: vi.fn(),
    }),
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('player startup in a preloaded world', () => {
  it('waits for a delayed module to install collision before enabling player physics', async () => {
    vi.stubGlobal('PHYSX', { PxSphereGeometry: class {} })
    let release
    const module = new Promise(resolve => {
      release = resolve
    })
    let floorInstalled = false
    const blueprint = {
      id: 'Room',
      model: 'room.glb',
      scriptFiles: { 'index.js': 'room.js' },
      preload: true,
    }
    const root = {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
      activate: vi.fn(),
      deactivate: vi.fn(),
    }
    const world = {
      blueprints: { get: () => blueprint },
      entities: { items: new Map() },
      loader: { preloader: Promise.resolve(), get: () => ({ toNodes: () => root }) },
      scripts: { loadModuleScript: () => module },
      setHot: vi.fn(),
      on: vi.fn(),
      emit: vi.fn(),
      networkRate: 0.1,
    }
    vi.spyOn(App.prototype, 'getWorldProxy').mockReturnValue({})
    vi.spyOn(App.prototype, 'getAppProxy').mockReturnValue({})
    const app = new App(world, {
      id: 'room',
      blueprint: 'Room',
      position: [0, 180, 0],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1],
    })
    world.entities.items.set('room', app)
    const player = {
      world,
      data: { position: [0, 180.2, 8], quaternion: [0, 0, 0, 1], health: 100 },
      applyAvatar: vi.fn(),
      initControl: vi.fn(),
      initCapsule: vi.fn(() => expect(floorInstalled).toBe(true)),
    }
    const ready = PlayerLocal.prototype.init.call(player)
    await Promise.resolve()
    await Promise.resolve()
    expect(player.initCapsule).not.toHaveBeenCalled()
    expect(world.emit).not.toHaveBeenCalledWith('ready', true)
    release({
      exec: () => {
        floorInstalled = true
      },
    })
    await ready
    expect(player.initCapsule).toHaveBeenCalledOnce()
    expect(world.emit).toHaveBeenCalledWith('ready', true)
  })
})
