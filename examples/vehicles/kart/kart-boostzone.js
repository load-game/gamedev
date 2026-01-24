app.remove(app.get('Block'))

let w = 5, h = 0.05, d = 10
const c = '#00aaff', o = 0.4
const boostColor = '#00ff00'

const rect = app.create('prim', {
  type: 'box',
  size: [w, h, d],
  color: c,
  opacity: o,
  physics: 'static',
  trigger: true
})
rect.position.set(0, h / 2, 0)
app.add(rect)
app.setRectangleSize = (W, H, D = d) => {
  w = W
  h = H
  d = D
  rect.size = [w, h, d]
  rect.position.set(0, h / 2, 0)
}

const BOOST_CONFIG = {
  cooldown: 1,
  duration: 5,
  force: 8000,
  initialForce: 25000,
}

const v1 = new Vector3(0, 0, -1)
const v2 = new Vector3()
const v3 = new Vector3()
const boostedKarts = new Map()
const lastBoostTime = new Map()

function findKart(hit) {
  if (!hit?.tag) return null
  let current = hit.tag
  let depth = 0
  while (current && depth < 10) {
    if (current.name === 'Car' && current.addForceAtLocalPos) return current
    current = current.parent
    depth++
  }
  return null
}

function applyForce(kart, forceVec) {
  if (kart.addForceAtLocalPos) {
    kart.addForceAtLocalPos(forceVec, new Vector3(0, 0, 0))
  } else if (kart.addForce) {
    kart.addForce(forceVec)
  }
}

if (world.isServer) {
  rect.onTriggerEnter = hit => {
    if (!hit) return
    
    const kart = findKart(hit)
    if (!kart) return
    
    const now = world.getTime ? world.getTime() : Date.now() / 1000
    const lastBoost = lastBoostTime.get(kart)
    if (lastBoost && (now - lastBoost) < BOOST_CONFIG.cooldown) return
    
    // Start boost with 5 second duration
    boostedKarts.set(kart, { timer: BOOST_CONFIG.duration })
    lastBoostTime.set(kart, now)
    
    // Apply strong forward force push
    v1.set(0, 0, -1)
    if (kart.quaternion) v1.applyQuaternion(kart.quaternion)
    applyForce(kart, v3.copy(v1).multiplyScalar(BOOST_CONFIG.initialForce))
  }
  
  rect.onTriggerLeave = hit => {
    const kart = findKart(hit)
    if (kart) boostedKarts.delete(kart)
  }
  
  app.on('fixedUpdate', delta => {
    for (const [kart, boost] of boostedKarts.entries()) {
      if (!kart || !kart.getLinearVelocity) {
        boostedKarts.delete(kart)
        continue
      }
      
      // Calculate forward direction based on kart's orientation
      v1.set(0, 0, -1)
      if (kart.quaternion) v1.applyQuaternion(kart.quaternion)
      
      // Get current velocity to maintain boost effectiveness
      kart.getLinearVelocity(v2)
      const forwardSpeed = v1.dot(v2)
      
      // Apply continuous boost force (stronger when going slower, maintains at higher speeds)
      // This keeps the kart going faster for the full 5 seconds
      const speedFactor = Math.max(0.8, 1 - Math.min(Math.abs(forwardSpeed) / 150, 0.2))
      applyForce(kart, v3.copy(v1).multiplyScalar(BOOST_CONFIG.force * speedFactor))
      
      // Update timer
      boost.timer -= delta
      if (boost.timer <= 0) {
        boostedKarts.delete(kart)
      }
    }
    
    // Clean up invalid karts
    for (const [kart] of boostedKarts.entries()) {
      if (!kart || !kart.parent) {
        boostedKarts.delete(kart)
      }
    }
  })
}

if (world.isClient) {
  app.on('update', () => {
    const player = world.getPlayer?.()
    if (!player?.position) {
      rect.color = c
      return
    }
    
    const padPos = v2.setFromMatrixPosition(rect.matrixWorld || app.matrixWorld)
    const distance = player.position.distanceTo(padPos)
    rect.color = distance < Math.max(w, d) / 2 + 1 ? boostColor : c
  })
}

app.on('destroy', () => {
  boostedKarts.clear()
  lastBoostTime.clear()
})
