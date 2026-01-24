({
  configure() {
    return {
      name: 'Wiggle Bone Debug',
      description: 'Logs spring bone activation under different conditions',
    }
  },

  init() {
    console.log('🦴 Wiggle Bone Test - Initialize')
    this.lastBonePositions = new Map()
    this.activeSprings = new Set()
    this.inactiveSprings = new Set()
    this.movementThreshold = 0.001 // Minimum movement to detect activity
    this.frameCount = 0
    this.logInterval = 60 // Log every 60 frames

    // Get player VRM reference
    const player = world.entities.player
    if (!player) {
      console.log('❌ No player found')
      return
    }

    const inst = player.avatar?.instance
    if (!inst) {
      console.log('❌ No avatar instance found')
      return
    }

    this.vrm = inst
    console.log('✅ VRM found, starting bone monitoring')

    // Collect all spring bones from original VRM
    this.springBones = []
    try {
      const origVRM = glb?.userData?.vrm || this.vrm.raw?.userData?.vrm
      const springManager = origVRM?.springBoneManager

      if (springManager && springManager.joints) {
        springManager.joints.forEach(joint => {
          if (joint.bone && joint.settings) {
            this.springBones.push({
              name: joint.bone.name || 'unnamed',
              bone: joint.bone,
              settings: joint.settings,
              lastPosition: null,
              movementCount: 0,
              totalMovement: 0,
              lastActiveTime: 0
            })
          }
        })
        console.log(`🔍 Found ${this.springBones.length} spring bones`)
      } else {
        console.log('ℹ️ No spring bone manager found')
      }
    } catch (e) {
      console.error('Error accessing spring bones:', e)
    }
  },

  update(delta) {
    if (!this.vrm || !this.springBones.length) return

    this.frameCount++

    // Get player state for context
    const player = world.entities.player
    const velocity = player?.rigidbody?.getLinearVelocity() || { x: 0, y: 0, z: 0 }
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)

    // Get locomotion state
    let locoState = 'unknown'
    try {
      locoState = this.vrm.loco?.mode || 'unknown'
    } catch (_) {}

    // Update spring bone monitoring
    this.springBones.forEach(springBone => {
      const bone = springBone.bone
      const currentPos = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld)

      if (springBone.lastPosition) {
        const movement = currentPos.distanceTo(springBone.lastPosition)
        springBone.totalMovement += movement
        springBone.movementCount++

        // Check if this bone moved significantly
        if (movement > this.movementThreshold) {
          springBone.lastActiveTime = Date.now()
          if (!this.activeSprings.has(springBone.name)) {
            this.activeSprings.add(springBone.name)
            this.inactiveSprings.delete(springBone.name)

            if (this.frameCount % this.logInterval === 0) {
              console.log(`🟢 Spring bone ACTIVATED: ${springBone.name} (movement: ${movement.toFixed(6)})`)
            }
          }
        } else {
          // Check if bone has been inactive for more than 1 second
          if (Date.now() - springBone.lastActiveTime > 1000) {
            if (this.activeSprings.has(springBone.name)) {
              this.activeSprings.delete(springBone.name)
              this.inactiveSprings.add(springBone.name)

              if (this.frameCount % this.logInterval === 0) {
                console.log(`⚪ Spring bone INACTIVE: ${springBone.name}`)
              }
            }
          }
        }
      }

      springBone.lastPosition = currentPos
    })

    // Log periodic status updates
    if (this.frameCount % this.logInterval === 0) {
      console.log(`
📊 Spring Bone Status Report (Frame ${this.frameCount}):
🏃 Player Speed: ${speed.toFixed(3)}m/s (${locoState})
🟢 Active Springs: ${this.activeSprings.size}/${this.springBones.length}
⚪ Inactive Springs: ${this.inactiveSprings.size}

🔥 ACTIVE BONES:
${Array.from(this.activeSprings).map(name => `  ✅ ${name}`).slice(0, 5).join('\n') || '  None'}

💤 INACTIVE BONES:
${Array.from(this.inactiveSprings).slice(0, 5).map(name => `  ❌ ${name}`).join('\n') || '  None'}

📈 MOVEMENT ANALYSIS (last 60 frames):
${this.springBones
  .filter(b => b.movementCount > 0)
  .slice(0, 5)
  .map(b => {
    const avgMovement = b.totalMovement / b.movementCount
    return `  ${b.name}: avg=${avgMovement.toFixed(6)}, total=${b.totalMovement.toFixed(4)}`
  }).join('\n') || '  No movement data'}
      `)

      // Reset movement counters
      this.springBones.forEach(b => {
        b.movementCount = 0
        b.totalMovement = 0
      })
    }

    // Log specific events
    if (locoState === 'FLIP' || locoState === 'BACKFLIP') {
      console.log(`🔄 FLIP DETECTED - Monitoring spring bone response...`)

      // Log spring bone response to flips specifically
      setTimeout(() => {
        setTimeout(() => {
          console.log(`🎯 Spring bone response 2s after flip: active=${this.activeSprings.size}/${this.springBones.length}`)
        }, 2000)
      }, 100)
    }
  },

  cleanup() {
    console.log(`🦴 Wiggle Bone Test - Cleanup`)
    console.log(`Final active springs: ${this.activeSprings.size}/${this.springBones.length}`)
    console.log(`Most responsive bones: ${Array.from(this.activeSprings).join(', ')}`)
  },
})