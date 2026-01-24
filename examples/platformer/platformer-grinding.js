app.remove(app.get('Block'))

app.configure([
  {
    key: 'grindEmote',
    type: 'file',
    kind: 'emote',
    label: 'Grinding Emote',
  },
  {
    key: 'deactivationTime',
    type: 'number',
    label: 'Deactivation Time (seconds)',
    dp: 1,
    initial: 0.5,
    min: 0.1,
    max: 2.0,
    step: 0.1,
  },
])

const RAIL_LENGTH = 50

const GRIND_CONFIG = {
  speed: 15,
  playerHeightOffset: 0.1,
  jumpOffCooldown: 0.2,
}

const DEFAULTS = {
  railWidth: 0.06,
  railHeight: 0.08,
  railColor: '#9aa0a6',
  zFightEpsilon: 0.005,
}

const rail = app.create('prim', {
  type: 'box',
  size: [DEFAULTS.railWidth, DEFAULTS.railHeight, RAIL_LENGTH],
  color: DEFAULTS.railColor,
  physics: 'static',
  position: [0, DEFAULTS.railHeight / 2 + DEFAULTS.zFightEpsilon, 0],
})
app.add(rail)
rail.tag = 'rail'

// Rail grinding system
if (world.isClient) {
  const { grindEmote, deactivationTime } = app.props
  const player = world.getPlayer()
  const control = app.control()

  let grinding = false
  let grindAnchor = null
  let currentEffect = null
  let grindPosition = 0
  let grindDirection = 1
  let jumpOffCooldown = 0
  let isExiting = false
  let lastPosition = new Vector3()

  const railStartZ = -RAIL_LENGTH / 2
  const railEndZ = RAIL_LENGTH / 2
  const v1 = new Vector3()
  const v2 = new Vector3()
  const DOWN = new Vector3(0, -1, 0)
  const layerMask = world.createLayerMask('environment')

  lastPosition.copy(player.position)

  function getRailWorldData() {
    const railWorldMatrix = rail.matrixWorld
    const pos = new Vector3()
    const scale = new Vector3()
    pos.setFromMatrixPosition(railWorldMatrix)
    scale.setFromMatrixScale(railWorldMatrix)
    return { pos, scale }
  }

  function stopGrinding(applyCooldown = true) {
    grinding = false
    player.applyEffect(null)
    currentEffect = null
    if (grindAnchor) {
      world.remove(grindAnchor)
      grindAnchor = null
    }
    jumpOffCooldown = GRIND_CONFIG.jumpOffCooldown
  }

  function startGrinding(playerPos) {
    if (grinding) return

    isExiting = false
    grinding = true

    const { pos: railWorldPos, scale: railWorldScale } = getRailWorldData()
    const railTopY = railWorldPos.y + (DEFAULTS.railHeight * railWorldScale.y) / 2
    const relativeZ = playerPos.z - railWorldPos.z
    const clampedZ = Math.max(railStartZ, Math.min(railEndZ, relativeZ))

    grindDirection = clampedZ < 0 ? 1 : -1
    grindPosition = clampedZ
    const rotationY = grindDirection > 0 ? Math.PI / 2 : -Math.PI / 2
    const targetPos = new Vector3(
      railWorldPos.x,
      railTopY + GRIND_CONFIG.playerHeightOffset,
      railWorldPos.z + grindPosition
    )

    player.teleport(targetPos, rotationY)
    grindAnchor = app.create('anchor', { id: `rail-grind-${player.id}` })
    grindAnchor.position.copy(targetPos)
    grindAnchor.rotation.y = rotationY + Math.PI / 2
    world.add(grindAnchor)

    currentEffect = player.applyEffect({
      anchor: grindAnchor,
      emote: grindEmote?.url ? `${grindEmote.url}?l=0` : '',
      snare: 0,
      turn: false,
      duration: null,
      cancellable: false,
      onEnd: () => {
        if (!isExiting) stopGrinding(false)
        isExiting = false
      },
    })
  }

  app.on('update', dt => {
    if (jumpOffCooldown > 0) {
      jumpOffCooldown -= dt
    }

    const playerPos = player.position

    if (grinding) {
      const jumpPressed = control.space?.pressed || control.space?.down
      const isMoving =
        control.keyW?.pressed ||
        control.keyW?.down ||
        control.keyS?.pressed ||
        control.keyS?.down ||
        control.keyA?.pressed ||
        control.keyA?.down ||
        control.keyD?.pressed ||
        control.keyD?.down ||
        control.arrowUp?.pressed ||
        control.arrowUp?.down ||
        control.arrowDown?.pressed ||
        control.arrowDown?.down ||
        control.arrowLeft?.pressed ||
        control.arrowLeft?.down ||
        control.arrowRight?.pressed ||
        control.arrowRight?.down

      if (jumpPressed || isMoving) {
        isExiting = true
        grinding = false
        jumpOffCooldown = GRIND_CONFIG.jumpOffCooldown
        const emoteUrl = grindEmote?.url || ''
        player.applyEffect({
          emote: emoteUrl,
          duration: deactivationTime || 0.5,
          cancellable: true,
        })
        currentEffect = null
        if (grindAnchor) {
          world.remove(grindAnchor)
          grindAnchor = null
        }
        const jumpDir = new Vector3(0, 0.5, grindDirection * 0.5)
        player.push(jumpDir.multiplyScalar(5))
        return
      }

      grindPosition += GRIND_CONFIG.speed * dt * grindDirection

      if ((grindDirection > 0 && grindPosition >= railEndZ) || (grindDirection < 0 && grindPosition <= railStartZ)) {
        grindPosition = grindDirection > 0 ? railEndZ : railStartZ
        stopGrinding(true)
        return
      }

      if (grindAnchor) {
        const { pos: railWorldPos, scale: railWorldScale } = getRailWorldData()
        const railTopY = railWorldPos.y + (DEFAULTS.railHeight * railWorldScale.y) / 2
        grindAnchor.position.set(
          railWorldPos.x,
          railTopY + GRIND_CONFIG.playerHeightOffset,
          railWorldPos.z + grindPosition
        )
      }
      return
    }

    if (jumpOffCooldown > 0) return

    if (dt > 0) {
      v2.copy(playerPos).sub(lastPosition).divideScalar(dt)
    } else {
      v2.set(0, 0, 0)
    }
    lastPosition.copy(playerPos)

    const { pos: railWorldPos, scale: railWorldScale } = getRailWorldData()
    const actualRailWidth = DEFAULTS.railWidth * railWorldScale.x
    const actualRailHeight = DEFAULTS.railHeight * railWorldScale.y
    const railTopY = railWorldPos.y + actualRailHeight / 2

    const distX = Math.abs(playerPos.x - railWorldPos.x)
    const distZ = Math.abs(playerPos.z - railWorldPos.z)
    const distY = playerPos.y - railTopY

    if (distX < 1.0 && distZ < RAIL_LENGTH / 2 && distY > -1.0 && distY < 3.5) {
      v1.copy(playerPos)
      v1.y += 1.2
      const hit = world.raycast(v1, DOWN, Math.abs(distY) + 2.2, layerMask)

      if (hit?.point) {
        const hitX = Math.abs(hit.point.x - railWorldPos.x)
        const hitZ = Math.abs(hit.point.z - railWorldPos.z)

        if (
          hitX < actualRailWidth / 2 + 0.8 &&
          hitZ < RAIL_LENGTH / 2 &&
          Math.abs(hit.point.y - railTopY) < 0.5 &&
          (!hit.normal || hit.normal.y > 0.4)
        ) {
          startGrinding(playerPos)
        }
      }
    }
  })

  world.on('leave', ({ playerId }) => {
    if (playerId === player.id) stopGrinding()
  })
}
