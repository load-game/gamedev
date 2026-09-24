import { ControlPriorities } from './ControlPriorities.js'

// Opt-in player picking. The stage raycast keeps walls and other geometry opaque.
export function createPlayerContext(entity, { enabled = () => true, onOpen }) {
  const world = entity.world
  if (!world.network.isClient) throw new Error('client_only')
  if (typeof onOpen !== 'function') throw new Error('onOpen_required')
  const controls = world.controls
  const control = controls.bind({ priority: ControlPriorities.ACTION })
  let gesture = null
  let disposed = false
  const reset = () => {
    gesture = null
    controls.pointer.rightDragging = false
  }
  control.mouseRight.onPress = () => {
    reset()
    if (!enabled() || world.pointer?.screenHit) return
    const locked = control.pointer.locked
    const point = control.pointer.position.clone()
    const hits = locked ? world.stage.raycastReticle() : world.stage.raycastPointer(point)
    const hit = hits.find(h => h.getEntity?.() !== world.entities.player)
    const player = hit?.getEntity?.()
    gesture = { player: player?.isPlayer ? player : null, point, locked, distance: 0 }
    return true // Suppress the legacy builder inspector while this handler owns right-click.
  }
  const move = event => {
    if (!gesture) return
    if (!enabled()) return reset()
    gesture.distance += Math.hypot(event.movementX || 0, event.movementY || 0)
    if (gesture.distance > 6) controls.pointer.rightDragging = true
  }
  const release = event => {
    if (event.button !== 2 || !gesture) return
    const pending = gesture
    reset()
    if (!enabled() || pending.distance > 6 || pending.player?.destroyed || !pending.player) return
    const point = pending.locked ? { x: control.screen.width / 2, y: control.screen.height / 2 } : pending.point
    control.pointer.unlock()
    onOpen({ playerId: pending.player.data.id, x: point.x, y: point.y })
  }
  const cancel = () => reset()
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', cancel)
  window.addEventListener('blur', cancel)
  const api = {
    dispose() {
      if (disposed) return
      disposed = true
      reset()
      control.release()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
    },
  }
  entity.on('destroy', api.dispose)
  return api
}
