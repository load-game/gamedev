export default (world, app, fetch, props, setTimeout) => {
    app.get('Block').active = false
    // Server: relay events to all clients
    if (world.isServer) {
      app.on('pushBone', data => {
        app.send('pushBone', data)
      })
      app.on('activateRagdoll', data => {
        app.send('activateRagdoll', data)
      })
    }
  
    if (!world.isClient) return
  
    const control = app.control()
  
    const origin = new Vector3()
    const direction = new Vector3()
    const impulse = new Vector3()
  
    const IMPULSE_STRENGTH = 25
    const MAX_DISTANCE = 100
    const layerMask = world.createLayerMask('environment', 'prop', 'player')
  
    // Listen for broadcasts and apply locally
    app.on('activateRagdoll', ({ playerId, force }) => {
      const player = world.getPlayer(playerId)
      if (!player) return
      player.ragdoll(true, new Vector3(...force))
    })
  
    app.on('pushBone', ({ playerId, bone, force, point }) => {
      const player = world.getPlayer(playerId)
      if (!player) return
      player.push(new Vector3(...force), { bone, point: point ? new Vector3(...point) : null })
    })
  
    control.mouseLeft.onPress = () => {
      origin.copy(control.camera.position)
      direction.set(0, 0, -1).applyQuaternion(control.camera.quaternion).normalize()
  
      const hit = world.raycast(origin, direction, MAX_DISTANCE, layerMask, { ignoreLocalPlayer: true })
      if (!hit) return
  
      impulse.copy(direction).multiplyScalar(IMPULSE_STRENGTH)
  
      if (hit.playerId) {
        if (hit.point) spawnImpact(hit.point)
        if (hit.bone) {
          // Hit a ragdoll bone — push it
          app.send('pushBone', {
            playerId: hit.playerId,
            bone: hit.bone,
            force: impulse.toArray(),
            point: hit.point.toArray(),
          })
        } else {
          // Hit player capsule — activate ragdoll
          app.send('activateRagdoll', {
            playerId: hit.playerId,
            force: impulse.toArray(),
          })
        }
      } else {
        // Hit environment — check proximity fallback
        const target = findNearestPlayer(hit.point)
        if (target) {
          if (hit.point) spawnImpact(hit.point)
          app.send('activateRagdoll', {
            playerId: target.id,
            force: impulse.toArray(),
          })
        }
      }
    }
  
    function findNearestPlayer(point) {
      const players = world.getPlayers()
      let closest = null
      let closestDist = 1.5 // max distance threshold (capsule radius + margin)
      for (const p of players) {
        // allow shooting any player including yourself
        const dx = point.x - p.position.x
        const dz = point.z - p.position.z
        const horizDist = Math.sqrt(dx * dx + dz * dz)
        const dy = point.y - p.position.y
        if (horizDist < closestDist && dy > -0.5 && dy < 2.0) {
          closestDist = horizDist
          closest = p
        }
      }
      return closest
    }
  
    function spawnImpact(point) {
      const impact = app.create('particles', {
        shape: ['point'],
        loop: false,
        duration: 0.5,
        rate: 0,
        bursts: [{ time: 0, count: 12 }],
        life: '0.1~0.4',
        speed: '1~3',
        size: '0.02~0.06',
        color: '#ff8800',
        emissive: '6',
        alpha: '0.9~1',
        direction: 0.8,
        blending: 'additive',
        space: 'world',
        max: 20,
        force: new Vector3(0, -3, 0),
      })
      impact.colorOverLife = '0,#ffaa33|0.4,#ff4400|1,#aa1100'
      impact.alphaOverLife = '0,1|0.6,0.6|1,0'
      impact.sizeOverLife = '0,1|1,0.2'
      impact.position.set(point.x, point.y, point.z)
      impact.onEnd = () => {
        world.remove(impact)
      }
      world.add(impact)
    }
  }
  