import * as THREE from './three.js'
import { OBB } from 'three/examples/jsm/math/OBB.js'
import { getRef } from '../nodes/Node.js'
import { ControlPriorities } from './ControlPriorities.js'

const copy = value => JSON.parse(JSON.stringify(value))
const finite = (v, n) => Array.isArray(v) && v.length === n && v.every(x => typeof x === 'number' && Number.isFinite(x))
export function snapScalar(value, step) {
  return step > 0 ? Math.round(value / step) * step : value
}
export function roomMatrix(frame) {
  if (!finite(frame.position, 3) || !Number.isFinite(frame.yaw)) throw new Error('invalid_room_frame')
  return new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(frame.position),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), frame.yaw),
    new THREE.Vector3(1, 1, 1)
  )
}
export function transformPoint(frame, point, inverse = false) {
  if (!finite(point, 3)) throw new Error('invalid_point')
  const m = roomMatrix(frame)
  if (inverse) m.invert()
  return new THREE.Vector3().fromArray(point).applyMatrix4(m).toArray()
}
function bounds(item, transform) {
  const rotation = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(transform.yaw))
  const center = new THREE.Vector3()
    .fromArray(item.center || [0, item.size[1] / 2, 0])
    .applyMatrix3(rotation)
    .add(new THREE.Vector3().fromArray(transform.position))
  return new OBB(center, new THREE.Vector3().fromArray(item.size).multiplyScalar(0.5), rotation)
}
export function validatePlacement(room, item, transform, placed = []) {
  if (!item || !finite(item.size, 3) || item.size.some(v => v <= 0)) return { ok: false, reason: 'invalid_item' }
  if (
    !transform ||
    !finite(transform.position, 3) ||
    !Number.isFinite(transform.yaw) ||
    Math.abs(transform.yaw) > Math.PI * 2
  )
    return { ok: false, reason: 'invalid_transform' }
  if (!finite(room.size, 3) || room.size.some(v => v <= 0)) return { ok: false, reason: 'invalid_room' }
  if (item.orientations && !item.orientations.some(y => Math.abs(y - transform.yaw) < 0.001))
    return { ok: false, reason: 'orientation' }
  if (!item.surfaces?.includes(transform.surface)) return { ok: false, reason: 'surface' }
  const box = bounds(item, transform)
  const enclosing = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(0, room.size[1] / 2, 0),
    new THREE.Vector3().fromArray(room.size)
  )
  const eps = 0.015
  enclosing.expandByScalar(eps)
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1]) {
        const corner = new THREE.Vector3(x, y, z).multiply(box.halfSize).applyMatrix3(box.rotation).add(box.center)
        if (!enclosing.containsPoint(corner)) return { ok: false, reason: 'bounds' }
      }
  if (transform.surface === 'floor' && Math.abs(transform.position[1]) > eps) return { ok: false, reason: 'floor' }
  if (transform.surface === 'wall') {
    const half = room.size.map(v => v / 2)
    const wall =
      (Math.abs(Math.abs(box.center.x) + box.halfSize.z - half[0]) < 0.03 &&
        Math.abs(Math.cos(transform.yaw)) < 0.001) ||
      (Math.abs(Math.abs(box.center.z) + box.halfSize.z - half[2]) < 0.03 && Math.abs(Math.sin(transform.yaw)) < 0.001)
    if (!wall) return { ok: false, reason: 'wall' }
  }
  for (const other of placed) {
    if (
      other.id === transform.id ||
      !other.transform ||
      item.collision === 'overlap' ||
      other.item.collision === 'overlap'
    )
      continue
    const candidate = bounds(other.item, other.transform)
    // Allow touching surfaces; reject penetrations. Uses the engine's Three OBB implementation.
    candidate.halfSize.addScalar(-0.005)
    if (box.intersectsOBB(candidate)) return { ok: false, reason: 'collision' }
  }
  return { ok: true, transform: { position: [...transform.position], yaw: transform.yaw, surface: transform.surface } }
}

export function createFurnishingAPI(entity) {
  const world = entity.world
  let active = null
  const api = {
    validate: validatePlacement,
    toWorld: (frame, p) => transformPoint(frame, p),
    toLocal: (frame, p) => transformPoint(frame, p, true),
    contains(frame, size, point) {
      const p = transformPoint(frame, point, true)
      return Math.abs(p[0]) <= size[0] / 2 && p[1] >= -0.2 && p[1] <= size[1] && Math.abs(p[2]) <= size[2] / 2
    },
    moveRoom(nodeProxy, frame, nextFrame, size) {
      const node = getRef(nodeProxy)
      if (!node || node.ctx?.entity !== entity) throw new Error('room_scope')
      const players = [...world.entities.players.values()]
      const occupants = players.filter(player => api.contains(frame, size, player.base.position.toArray()))
      node.position.fromArray(nextFrame.position)
      node.rotation.y = nextFrame.yaw
      for (const player of occupants) {
        if (world.network.isClient && player.data.id !== world.network.id) continue
        const local = transformPoint(frame, player.base.position.toArray(), true)
        const p = new THREE.Vector3().fromArray(transformPoint(nextFrame, local))
        entity.getPlayerProxy(player.data.id).teleport(p, player.base.rotation.y + nextFrame.yaw - frame.yaw)
      }
    },
    begin({
      room,
      frame,
      node: nodeProxy,
      item,
      transform,
      placed = () => [],
      onPreview = () => {},
      onCommit,
      onEnd = () => {},
      authorized = () => true,
    }) {
      if (!world.network.isClient) throw new Error('client_only')
      active?.dispose()
      const node = getRef(nodeProxy)
      if (!node || node.ctx?.entity !== entity) throw new Error('item_scope')
      if (!authorized()) throw new Error('edit_revoked')
      const original = { position: node.position.toArray(), yaw: node.rotation.y }
      let current = copy(transform),
        history = [],
        future = [],
        disposed = false,
        pending = false,
        grid = 0
      const control = world.controls.bind({ priority: ControlPriorities.APP })
      control.pointer.lockOnClick = false
      control.pointer.unlock()
      control.keyW.capture = true
      control.keyA.capture = true
      control.keyS.capture = true
      control.keyD.capture = true
      control.space.capture = true
      control.camera.write = true
      const cameraPosition = transformPoint(frame(), [0, 10, 9])
      const look = new THREE.PerspectiveCamera()
      look.position.fromArray(cameraPosition)
      look.lookAt(new THREE.Vector3().fromArray(transformPoint(frame(), [0, 0, 0])))
      control.camera.position.copy(look.position)
      control.camera.quaternion.copy(look.quaternion)
      control.camera.zoom = 0
      function assertActive() {
        if (disposed || pending || !authorized()) throw new Error('edit_revoked')
      }
      function show(t, record = true) {
        assertActive()
        if (record) {
          history.push(copy(current))
          history = history.slice(-32)
          future = []
        }
        current = copy(t)
        node.position.fromArray(current.position)
        node.rotation.y = current.yaw
        const result = validatePlacement(room, item, current, placed())
        onPreview(copy(current), result)
        return result
      }
      const session = {
        get transform() {
          return copy(current)
        },
        setGrid(step) {
          if (!Number.isFinite(step) || step < 0 || step > 2) throw new Error('invalid_grid')
          grid = step
        },
        preview: show,
        nudge(dx, dz) {
          const p = [...current.position]
          p[0] = snapScalar(p[0] + (grid && dx ? Math.sign(dx) * grid : dx), grid)
          p[2] = snapScalar(p[2] + (grid && dz ? Math.sign(dz) * grid : dz), grid)
          return show({ ...current, position: p })
        },
        rotate(angle = Math.PI / 12) {
          return show({ ...current, yaw: ((current.yaw + angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI })
        },
        undo() {
          assertActive()
          if (!history.length) return
          const t = history.pop()
          future.push(copy(current))
          show(t, false)
        },
        redo() {
          assertActive()
          if (!future.length) return
          const t = future.pop()
          history.push(copy(current))
          show(t, false)
        },
        async confirm() {
          assertActive()
          const result = validatePlacement(room, item, current, placed())
          if (!result.ok) throw new Error(result.reason)
          pending = true
          try {
            await onCommit(copy(current))
            if (!authorized()) throw new Error('edit_revoked')
            session.dispose(true)
          } catch (error) {
            session.dispose()
            throw error
          }
        },
        dispose(accepted = false) {
          if (disposed) return
          disposed = true
          if (!accepted) {
            node.position.fromArray(original.position)
            node.rotation.y = original.yaw
          }
          control.release()
          entity.off('update', update)
          if (active === session) active = null
          onEnd(accepted)
        },
      }
      function update() {
        if (!authorized()) return session.dispose()
        control.camera.position.fromArray(transformPoint(frame(), [0, 10, 9]))
        if (!control.mouseLeft.pressed || pending) return
        const hits = world.stage.raycastPointer(control.pointer.position)
        const inItem = candidate => {
          for (let n = candidate; n; n = n.parent) if (n === node) return true
          return false
        }
        const hit = hits
          .sort((a, b) => a.distance - b.distance)
          .find(h => {
            if (!h.point || inItem(h.node)) return false
            const p = transformPoint(frame(), h.point.toArray(), true)
            return current.surface === 'floor'
              ? Math.abs(p[1]) < 0.3
              : p[1] >= 0 &&
                  p[1] <= room.size[1] &&
                  (Math.abs(Math.abs(p[0]) - room.size[0] / 2) < 0.3 ||
                    Math.abs(Math.abs(p[2]) - room.size[2] / 2) < 0.3)
          })
        if (!hit) return
        const local = transformPoint(frame(), hit.point.toArray(), true)
        let position = local.map(v => snapScalar(v, grid)),
          yaw = current.yaw
        if (current.surface === 'floor') {
          position[1] = 0
          // Reuse registered engine snap points, never maintain a world-local index.
          if (grid && world.snaps) {
            const point = world.snaps.octree.query(hit.point, 0.4)[0]?.position
            if (point) {
              position = transformPoint(frame(), point.toArray(), true)
              position[1] = 0
            }
          }
        } else {
          const onX = Math.abs(Math.abs(local[0]) - room.size[0] / 2) < Math.abs(Math.abs(local[2]) - room.size[2] / 2)
          const axis = onX ? 0 : 2,
            sign = Math.sign(local[axis])
          position[axis] = sign * (room.size[axis] / 2 - item.size[2] / 2)
          position[1] = snapScalar(local[1] - item.size[1] / 2, grid)
          yaw = onX ? (-sign * Math.PI) / 2 : sign > 0 ? Math.PI : 0
        }
        show({ ...current, position, yaw })
      }
      control.escape.onPress = () => session.dispose()
      control.keyR.onPress = () => session.rotate()
      entity.on('update', update)
      active = session
      show(current, false)
      return session
    },
    dispose() {
      active?.dispose()
    },
  }
  entity.on('destroy', () => api.dispose())
  return api
}
