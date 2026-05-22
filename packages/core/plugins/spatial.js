import { isNumber } from 'lodash-es'
import * as THREE from '../extras/three.js'
import { definePlugin } from '../plugins.js'
import { Layers } from '../extras/Layers.js'
import { Anchors } from './spatial/Anchors.js'
import { Avatars } from './spatial/Avatars.js'
import { Physics } from './spatial/Physics.js'

export { Anchors, Avatars, Physics }

const raycastHits = new WeakMap()

function getRaycastHit(world) {
  let raycastHit = raycastHits.get(world)
  if (!raycastHit) {
    raycastHit = {
      point: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      distance: 0,
      tag: null,
      playerId: null,
      bone: null,
    }
    raycastHits.set(world, raycastHit)
  }
  return raycastHit
}

export const spatialScriptApi = {
  world: {
    createLayerMask(_entity, ...groups) {
      let mask = 0
      for (const group of groups) {
        if (!Layers[group]) throw new Error(`[createLayerMask] invalid group: ${group}`)
        mask |= Layers[group].group
      }
      return mask
    },
    raycast(entity, origin, direction, maxDistance, layerMask, opts) {
      const { world } = entity
      if (!origin?.isVector3) throw new Error('[raycast] origin must be Vector3')
      if (!direction?.isVector3) throw new Error('[raycast] direction must be Vector3')
      if (maxDistance !== undefined && maxDistance !== null && !isNumber(maxDistance)) {
        throw new Error('[raycast] maxDistance must be number')
      }
      if (layerMask !== undefined && layerMask !== null && !isNumber(layerMask)) {
        throw new Error('[raycast] layerMask must be number')
      }
      const ignorePlayerId = opts?.ignoreLocalPlayer ? world.network?.id : opts?.ignorePlayerId
      const hit = world.physics.raycast(origin, direction, maxDistance, layerMask, ignorePlayerId)
      if (!hit) return null
      const raycastHit = getRaycastHit(world)
      raycastHit.point.copy(hit.point)
      raycastHit.normal.copy(hit.normal)
      raycastHit.distance = hit.distance
      raycastHit.tag = hit.handle?.tag
      raycastHit.playerId = hit.handle?.playerId
      raycastHit.bone = hit.handle?.bone || null
      return raycastHit
    },
    overlapSphere(entity, radius, origin, layerMask) {
      const hits = entity.world.physics.overlapSphere(radius, origin, layerMask)
      return hits.map(hit => hit.proxy)
    },
  },
}

export const spatialPlugin = definePlugin({
  name: '@gamedev/plugin-spatial',
  requires: ['core', 'apps', 'entities'],
  provides: ['spatial'],
  systems: [
    ['anchors', Anchors],
    ['avatars', Avatars],
    ['physics', Physics],
  ],
  scripts: spatialScriptApi,
})
